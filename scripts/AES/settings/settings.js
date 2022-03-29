
var CONSTANTS = {
    GUIDED_SETUP_ID: "411b157f0f602010310be3d1df767e7b",
    AES_USER_ROLE: "97f4a0c20f123300e54f3c71df767ea2",
    DELEGATED_DEV_ROLE: "a8772c23673302006cc275f557415ad4",
    AES_SCOPE: "sn_app_eng_studio",
    AES_PLUGIN_ID: "com.snc.app-engine-studio"
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

    var gr = new GlideAggregate("ua_app_usage");
    if(!gr.isValid())
        return appUsage;

    gr.setWorkflow(false);	
    gr.addEncodedQuery("app_name=App Engine Studio^ORapp_name=Studio^ORapp_name=Table Builder^ORapp_name=App Engine Management Center");
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

var getInstallationDetails = function() {    
    var gr = new GlideRecord("sys_store_app");
    gr.setWorkflow(false);
    gr.addQuery("scope=" + CONSTANTS.AES_SCOPE);
    gr.query();

    var installationDetails = {
        installed: false,
        licensed: false,
        licensedPlugin: false,
        licensedApp: false,
        version: ""
    };

    if(gr.next()) {
        installationDetails.installed = true;
        installationDetails.installedOn = gr.getValue("install_date");
        installationDetails.version = gr.getValue("version")
    }

    try {
        installationDetails.licensedPlugin = sn_lef.GlideEntitlement.hasLicenseForApp(CONSTANTS.AES_PLUGIN_ID);
    } catch (e) { }
    
    try {
        installationDetails.licensedApp = sn_lef.GlideEntitlement.hasLicenseForApp(CONSTANTS.AES_SCOPE);
    } catch (e) { }

    installationDetails.licensed = (installationDetails.licensedPlugin || installationDetails.licensedApp);

    return installationDetails;
};

var getSystemPropertySettings = function() {
    var gr = new GlideRecord("sys_properties");
    gr.setWorkflow(false);
    gr.setLimit(30);
    gr.addEncodedQuery("sys_scope.name=App Engine Studio");
    gr.query();

    var results = {};

    while(gr.next()){
        results[gr.getValue("name")] = gr.getValue("value");
    }

    return results;
};

var getCurrentLanguage = function() {
	var language = "N/A";
	try {
		language = gs.getSession().getLanguage();
	} catch(e) {}

	return language;
};


(function(){

    var results = {
        currentLanguage: getCurrentLanguage(),
        installationDetails: getInstallationDetails(),
        applicationUsage: getApplicationUsage(),
        systemPropertySettings: getSystemPropertySettings(),
        guidedSetupStatus: getGuidedSetupStatus()
    };

    gs.print(JSON.stringify(results));

})();