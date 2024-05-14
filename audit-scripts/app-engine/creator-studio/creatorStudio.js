
var CONSTANTS = {
    GUIDED_SETUP_ID: "f0498644070c4210909ac41f0ad300ce", 
    CREATOR_STUDIO_SCOPE: "sn_creatorstudio"
};

var getGuidedSetupStatus = function() {

	var setupStatus = {};

	//
	// Cache the status records to reduce queries
	//
	var contentStatus = (function() {
		var gr = new GlideRecord("gsw_status_of_content");
		gr.setWorkflow(false);
		gr.addEncodedQuery("content=" + CONSTANTS.GUIDED_SETUP_ID + "^ORcontent.parent=" + CONSTANTS.GUIDED_SETUP_ID + "^ORcontent.parent.parent=" + CONSTANTS.GUIDED_SETUP_ID);
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
		gr.addEncodedQuery("sys_id=" + CONSTANTS.GUIDED_SETUP_ID);
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
	gr.addEncodedQuery("parent=" + CONSTANTS.GUIDED_SETUP_ID);
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


var getApplicationUsage = function() {
    var appUsage = {};
    var appNames = [
        'App Engine Studio',
        'Creator Studio',
        'Table Builder',
        'Table Builder for App Engine',
        'App Engine Management Center',
        'Studio',
        'Workspace Builder',
        'Workspace Builder for App Engine',
        'PDF Extractor'
    ];

    var gr = new GlideAggregate("ua_app_usage");
    if(!gr.isValid())
        return appUsage;

    gr.setWorkflow(false);	
	gr.addEncodedQuery("app_nameIN" + appNames.join(","));
    gr.addAggregate("COUNT");
    gr.groupBy("app_name");
    gr.groupBy("time_stamp");
    gr.query();

    while(gr.next()) {
        var appName = gr.app_name.toString(),
            accrualPeriod = gr.time_stamp.toString(),
            count = parseInt(gr.getAggregate("COUNT"));

        if(appUsage[appName] == undefined)
            appUsage[appName] = {};

        appUsage[appName][accrualPeriod] = count;
    }

    return appUsage;
};

var getInstallationDetails = function() {    
    var gr = new GlideRecord("sys_store_app");
    gr.setWorkflow(false);
    gr.addQuery("scope=" + CONSTANTS.CREATOR_STUDIO_SCOPE);
    gr.query();

    var installationDetails = {
        installed: false,
        installedOn: "",
        version: ""
    };

    if(gr.next()) {
        var installDate = gr.getValue("install_date");

        installationDetails.installed = true;
        installationDetails.installedOn = (installDate && installDate != null ? new GlideDateTime(installDate).getDate().getValue() : "");
        installationDetails.version = gr.getValue("version");
    }

    return installationDetails;
};

var getSystemPropertySettings = function() {
    var gr = new GlideRecord("sys_properties");
    gr.setWorkflow(false);
    gr.setLimit(30);
    gr.addEncodedQuery("sys_scope.name=Creator Studio");
    gr.query();

    var results = {};

    while(gr.next()){
        results[gr.getValue("name")] = gr.getValue("value");
    }

    return results;
};

var setSessionLanguage = function() {
    try {
        gs.getSession().setLanguage("en");
    } catch(e) { }
};

var getCreatorStudioUserCounts = function() {
    var gr = new GlideAggregate("sys_user_has_role");
    gr.setWorkflow(false);
    gr.addEncodedQuery("role.sys_scope.scope=" + CONSTANTS.CREATOR_STUDIO_SCOPE);
    gr.groupBy("role");
    gr.addAggregate("COUNT");
    gr.query();

    var roles = {};

    while(gr.next()) {
        var roleName = gr.role.name.toString();

        roles[roleName] = parseInt(gr.getAggregate("COUNT"));
    }

    return roles;
};

var getAppCounts = function() {
    var scopes = [];
    var results = {
        totalApps: 0,
        totalForms: 0,
        totalProcesses: 0,
        totalRecords: 0,
        totalFulfillers: 0
    };

    (function(){
        var gr = new GlideRecord("sn_creatorstudio_request_app_config");

        if(!gr.isValid())
            return apps;

        gr.setWorkflow(false);
        gr.query();

        while(gr.next()) {
            scopes.push(gr.sys_scope.scope.toString());
        }

    })();

    results.totalApps = scopes.length;

    if(results.totalApps == 0)
        return results;

    (function(){
        var gr = new GlideAggregate("sc_cat_item_producer");
        gr.setWorkflow(false);
        gr.addEncodedQuery("published_refISEMPTY^sys_scope.scopeIN" + scopes.join());
        gr.addAggregate("COUNT");
        gr.query();

        results.totalForms = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

    })();

    (function(){
        var gr = new GlideAggregate("sys_pd_process_definition");
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_scope.scopeIN" + scopes.join());
        gr.addAggregate("COUNT");
        gr.query();

        results.totalProcesses = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

    })();

    (function(){
        var gr = new GlideAggregate("sn_creatorstudio_task");
        gr.setWorkflow(false);
        gr.addAggregate("COUNT");
        gr.query();

        results.totalRecords = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

    })();

    (function(){
        var gr = new GlideAggregate("sys_user_has_role");
        gr.setWorkflow(false);
        gr.addEncodedQuery("role.sys_scope.scopeIN" + scopes.join());
        gr.addAggregate("COUNT");
        gr.query();

        results.totalFulfillers = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

    })();


    return results;
};

(function(){

    setSessionLanguage();

    var results = {
        installationDetails: getInstallationDetails(),
        applicationUsage: getApplicationUsage(),
        systemPropertySettings: getSystemPropertySettings(),
        guidedSetupStatus: getGuidedSetupStatus(),
        userRoleCounts: getCreatorStudioUserCounts(),
        appCounts: getAppCounts()
    };

    gs.print(JSON.stringify(results));

})();