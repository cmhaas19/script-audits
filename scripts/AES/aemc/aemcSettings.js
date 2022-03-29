var CONSTANTS = {
    AEMC_GUIDED_SETUP_ID: "6583c7e5c3410110b83971e54440ddde",
    APP_INTAKE_GUIDED_SETUP_ID: "093fd817c7c90110408bc8d6f2c2603a",
    PIPELINE_GUIDED_SETUP_ID: "8c8ed5cb9b0770100290af417ef04b84",
    AEMC_SCOPE: "sn_aemc",
    APP_INTAKE_SYS_ID: "ebbb2414c3013010b83971e54440dd57",
    AEMC_APP_NAME: "App Engine Management Center"
};

var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getCurrentLanguage = function() {
	var language = "N/A";
	try {
		language = gs.getSession().getLanguage();
	} catch(e) {}

	return language;
};

var getAllGuidedSetupsStatuses = function() {
    return {
        aemcGuidedSetup: getGuidedSetupStatus(CONSTANTS.AEMC_GUIDED_SETUP_ID),
        appIntakeGuidedSetup: getGuidedSetupStatus(CONSTANTS.APP_INTAKE_GUIDED_SETUP_ID),
        pipelineGuidedSetup: getGuidedSetupStatus(CONSTANTS.PIPELINE_GUIDED_SETUP_ID)
    };
};

var getGuidedSetupStatus = function(gsId) {

	var setupStatus = {};

	//
	// Cache the status records to reduce queries
	//
	var contentStatus = (function() {
		var gr = new GlideRecord("gsw_status_of_content");
		gr.setWorkflow(false);
		gr.addEncodedQuery("content=" + gsId + "^ORcontent.parent=" + gsId + "^ORcontent.parent.parent=" + gsId);
		gr.query();

		var statuses = {};

		while(gr.next()){
			statuses[gr.getValue("content")] = {
				status: gr.status.getDisplayValue(),
				progress: gr.getValue("progress")
			}
		}

		return {
			get: function(contentId) {
				if(statuses[contentId])
					return statuses[contentId];
				else
					return { status: "Not Started", progress: 0 };
			}
		};

	})();

	//
	// Get the main record
	//
	(function(){
		var gr = new GlideRecord("gsw_content_group");
		gr.setWorkflow(false);
		gr.addEncodedQuery("sys_id=" + gsId);
		gr.query();

		if(gr.next()){
			var currentStatus = contentStatus.get(gr.getUniqueValue());

			setupStatus.name = gr.getValue("title");
			setupStatus.status = currentStatus.status;
			setupStatus.progress = currentStatus.progress;
			setupStatus.steps = [];
		}

	})();

	var getInfoSteps = function(id) {
		var gr = new GlideRecord("gsw_content_information");
		gr.setWorkflow(false);
		gr.addEncodedQuery("parent=" + id);
		gr.query();

		var steps = [];

		while(gr.next()){
			var currentStatus = contentStatus.get(gr.getUniqueValue());

			steps.push({
				name: gr.getValue("title"),
				status: currentStatus.status,
				progress: currentStatus.progress
			});
		}

		return steps;
	};

	//
	// Get the child steps
	//
	var gr = new GlideRecord("gsw_content_group");
	gr.setWorkflow(false);
	gr.addEncodedQuery("parent=" + gsId);
	gr.query();

	while(gr.next()) {
		var currentStatus = contentStatus.get(gr.getUniqueValue());

		setupStatus.steps.push({
			name: gr.getValue("title"),
			status: currentStatus.status,
			progress: currentStatus.progress,
			steps: getInfoSteps(gr.getUniqueValue())
		});
	}

	return setupStatus;
};

var getAllInstallationDetails = function() {
    return {
        aemc: getInstallationDetails(CONSTANTS.AEMC_SCOPE),
        deploymentPipeline: getInstallationDetails("sn_deploy_pipeline"),
        appEngineNotifications: getInstallationDetails("sn_app_eng_notify"),
        appIntake: getInstallationDetails("sn_app_intake"),
        collaborationRequests: getInstallationDetails("sn_collab_request")
    };
};

var getInstallationDetails = function(scope) {    
    var gr = new GlideRecord("sys_store_app");
    gr.setWorkflow(false);
    gr.addQuery("scope=" + scope);
    gr.query();

    var installationDetails = {
        installed: false,
        version: ""
    };

    if(gr.next()) {
        installationDetails.installed = true;
        installationDetails.installedOn = new GlideDateTime(gr.getValue("install_date")).getDate().getValue(),
        installationDetails.version = gr.getValue("version")
    }

    return installationDetails;
};

var getApplicationUsage = function() {
    var appUsage = {};

    var gr = new GlideAggregate("ua_app_usage");

    if(!gr.isValid())
        return appUsage;

    gr.setWorkflow(false);	
    gr.addEncodedQuery("app_name=" + CONSTANTS.AEMC_APP_NAME);
    gr.addAggregate("COUNT");
    gr.groupBy("app_name");
    gr.groupBy("time_stamp");
    gr.query();

    while(gr.next()) {
        var appName = gr.app_name.toString(),
            accrualPeriod = gr.time_stamp.toString(),
            count = gr.getAggregate("COUNT");

        if(appUsage[appName] == undefined)
            appUsage[appName] = {};

        appUsage[appName][accrualPeriod] = count;
    }

    return appUsage;
};

var getDeploymentCounts = function() {
    var months = {};

    (function(){
        var gr = new GlideAggregate("sn_deploy_pipeline_deployment_request");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.addEncodedQuery("app_sys_id!=NULL");
        gr.addTrend("sys_created_on", 'Month');
        gr.addAggregate("COUNT");
        gr.setGroup(false);
        gr.query();

        while(gr.next()){
            var month = gr.getValue("timeref");
            months[month] = parseInt(gr.getAggregate("COUNT"));
        } 

    })();

    return months;
};

var getCollaborationCounts = function() {
    var months = {};

    (function(){
        var gr = new GlideAggregate("sn_collab_request_dev_collab_task");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.addTrend("sys_created_on", 'Month');
        gr.addAggregate("COUNT");
        gr.setGroup(false);
        gr.query();

        while(gr.next()){
            var month = gr.getValue("timeref");
            months[month] = parseInt(gr.getAggregate("COUNT"));
        } 

    })();

    return months;
};

var getAppIntakeCounts = function() {
    var results = {
        installed: false,
        active: false,
        totalRequestCounts: 0,
        months: {}
    };

    (function(){
        var gr = new GlideRecord("sc_cat_item");
        gr.setWorkflow(false);
        
        if(gr.get(CONSTANTS.APP_INTAKE_SYS_ID)){
            results.installed = true;
            results.active = (gr.getValue("active") == "1");
        }
    })();

    (function(){
        var gr = new GlideAggregate("sc_req_item");
        gr.setWorkflow(false);
        gr.addEncodedQuery("cat_item=" + CONSTANTS.APP_INTAKE_SYS_ID);
        gr.addTrend("sys_created_on", 'Month');
        gr.addAggregate("COUNT");
        gr.setGroup(false);
        gr.query();

        while(gr.next()){
            var month = gr.getValue("timeref");
            var count = parseInt(gr.getAggregate("COUNT"));
            results.months[month] = count;
            results.totalRequestCounts += count;
        }
    })();

    return results;
};

var getPipelineConfigurations = function() {
    var pipelines = {};

    (function(){
        var gr = new GlideRecord("sn_pipeline_pipeline");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.setLimit(100);
        gr.query();

        while(gr.next()) {
            pipelines[gr.getUniqueValue()] = {
                name: gr.getValue("name"),
                active: (gr.getValue("active") == "1"),
                createdOn: new GlideDateTime(gr.getValue("sys_created_on")).getDate().getValue(),
                type: {
                    id: gr.getValue("pipeline_type"),
                    name: gr.pipeline_type.getDisplayValue()
                },
                sourceEnvironment: {
                    id: gr.getValue("source_environment"),
                    name: gr.source_environment.getDisplayValue()
                },
                environments: []
            }
        }
    })();

    (function(){
        var gr = new GlideRecord("sn_pipeline_pipeline_environment_order");

        if(!gr.isValid())
            return;
            
        gr.setWorkflow(false);
        gr.orderBy("order");
        gr.query();

        while(gr.next()) {
            var id = gr.getValue("pipeline");
  
            pipelines[id].environments.push({
                order: gr.getValue("order"),
                environment: {
                    id: gr.environment.sys_id.toString(),
                    name: gr.environment.name.toString(),
                    instanceId: gr.environment.instance_id.toString(),
                    instanceType: gr.environment.type.getDisplayValue(),
                    instanceUrl: gr.environment.instance_url.toString(),
                    isController: (gr.environment.is_controller.toString() == "true")
                }
            });
        }
    })();
    
    return pipelines;
};

(function(){

    var results = {
        currentLanguage: getCurrentLanguage(),
        companyCode: getCompanyCode(),
        guidedSetupStatus: getAllGuidedSetupsStatuses(),
        installationStatus: getAllInstallationDetails(),
        applicationUsage: getApplicationUsage(),
        appIntakeRequests: getAppIntakeCounts(),
        deploymentRequests: getDeploymentCounts(),
        collaborationRequests: getCollaborationCounts(),
        pipelineConfigurations: getPipelineConfigurations()
    };

    gs.print(JSON.stringify(results));

})();