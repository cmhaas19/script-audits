
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
	// Get the main ecord
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

var getDeveloperRoles = function() {

    var getUserCount = function(query) {
        var gr = new GlideAggregate("sys_user_has_role");
		gr.setWorkflow(false);	
		gr.addEncodedQuery(query);
		gr.groupBy("user");
		gr.query();

		return (gr.next() ? gr.getRowCount() : 0);
    };

	var getCountsForRole = function(role) {
        var days = [30, 60, 90, 180, 360];
        var results = {
            total: getUserCount("role=" + role + "^user.active=true")
        };

        days.forEach(function(daysAgo) {
            results[daysAgo] = getUserCount("role=" + role + "^user.active=true^user.last_login_timeISNOTEMPTY^user.last_login_time>javascript:gs.daysAgo(" + daysAgo + ")");
        });

        return results;
	};

	return {
		aesUsers: getCountsForRole(CONSTANTS.AES_USER_ROLE),
		delegatedDevelopers: getCountsForRole(CONSTANTS.DELEGATED_DEV_ROLE)
	};
};


var getGroupsWithRole = function(){
    var groups = {};

    var gr = new GlideAggregate("sys_user_grmember");
    gr.setWorkflow(false);
    gr.groupBy("group");
    gr.addAggregate("COUNT");
    gr.addQuery("user.active=true");

    var groupRoles = gr.addJoinQuery("sys_group_has_role", "group", "group");
	groupRoles.addCondition("role", "=", CONSTANTS.AES_USER_ROLE);

    gr.query();

    while(gr.next()){
        groups[gr.group.getDisplayValue()] = parseInt(gr.getAggregate("COUNT"));
    }

    return groups;
};

var getApplicationUsage = function() {
    var appUsage = {};

    var gr = new GlideAggregate("ua_app_usage");
    gr.setWorkflow(false);	
    gr.addEncodedQuery("app_name=App Engine Studio^ORapp_name=Studio^ORapp_name=Table Builder");
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
        installed: gr.next()
    };

    if(installationDetails.installed) {
        installationDetails.installedOn = gr.getValue("install_date");
    }

    return installationDetails;
};

var getDeploymentRequests = function() {
    var gr = new GlideRecord("sn_app_eng_studio_deployment_request");
    gr.setWorkflow(false);
    gr.addEncodedQuery("state=3^app_sys_id!=NULL");
    gr.query();

    var data = {};

    while(gr.next()){
        data[gr.getUniqueValue()] = {
            action: gr.getValue("action"),
            createdOn: gr.getValue("sys_created_on"),
            appSysId: gr.getValue("app_sys_id")
        };
    }

    return data;
};

var getPipelineCount = function() {
    var gr = new GlideAggregate("sn_app_eng_studio_pipeline");
    gr.setWorkflow(false);
    gr.addEncodedQuery("active=true");
    gr.addAggregate("COUNT");
    gr.query();

    return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
};

var getLicenseInfo = function() {
    var licenseInfo = {
        licensed: false,
        licensedPlugin: false,
        licensedApp: false
    };
	
	try {
		licenseInfo.licensedPlugin = sn_lef.GlideEntitlement.hasLicenseForApp(CONSTANTS.AES_PLUGIN_ID);
	} catch (e) { }
	
	try {
        licenseInfo.licensedApp = sn_lef.GlideEntitlement.hasLicenseForApp(CONSTANTS.AES_SCOPE);
    } catch (e) { }

    licenseInfo.licensed = (licenseInfo.licensedPlugin || licenseInfo.licensedApp);

    return licenseInfo;
};

var getSystemPropertySettings = function() {
    var gr = new GlideRecord("sys_properties");
    gr.setWorkflow(false);
    gr.addEncodedQuery("sys_scope.name=App Engine Studio");
    gr.query();

    var results = {};

    while(gr.next()){
        results[gr.getValue("name")] = gr.getValue("value");
    }

    return results;
};

var getRoleComparisons = function() {

    var getUsersByRole = function(role) {
        var gr = new GlideRecord("sys_user_has_role");
        gr.setWorkflow(false);	
		gr.addEncodedQuery("user.active=true^role=" + role + "^user.last_login_timeISNOTEMPTY^user.last_login_time>javascript:gs.daysAgo(90)");
        gr.query();

        var users = {};

        while(gr.next()){
            users[gr.getValue("user")] = gr.getValue("user");
        }

        return users;
    };

    var compareUsers = function(usersA, usersB) {
        var count = 0;

        for(var userId in usersA){
            if(usersB[userId] == undefined)
                count++;
        }

        return count;
    };

    var delegatedDevs = getUsersByRole(CONSTANTS.DELEGATED_DEV_ROLE);
    var aesUsers = getUsersByRole(CONSTANTS.AES_USER_ROLE);

    return  {
        delegatedDevCount: Object.keys(delegatedDevs).length,
        aesUserCount: Object.keys(aesUsers).length,
        delegatedDevsNotAlsoAESUsers: compareUsers(delegatedDevs, aesUsers),
        aesUsersNotAlsoDelegatedDevs: compareUsers(aesUsers, delegatedDevs)
    };

};

(function(){

    var results = {
        installationDetails: getInstallationDetails()
    };

    if(results.installationDetails.installed) {
        results.roleComparison = getRoleComparisons();
        results.systemPropertySettings = getSystemPropertySettings();
        results.licenseInfo = getLicenseInfo();
        results.pipelineCount = getPipelineCount();
        results.guidedSetupStatus = getGuidedSetupStatus();
        results.developerRoles = getDeveloperRoles();
        results.groupsWithAESRole = getGroupsWithRole();
        results.applicationUsage = getApplicationUsage();
        results.deploymentRequests = getDeploymentRequests();
    
        gs.print(JSON.stringify(results));
    }

})();