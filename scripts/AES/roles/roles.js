
var CONSTANTS = {
    GUIDED_SETUP_ID: "411b157f0f602010310be3d1df767e7b",
    AES_USER_ROLE: "97f4a0c20f123300e54f3c71df767ea2",
    DELEGATED_DEV_ROLE: "a8772c23673302006cc275f557415ad4",
    SOURCE_CONTROL_ROLE: "",
    AES_SCOPE: "sn_app_eng_studio",
    AES_PLUGIN_ID: "com.snc.app-engine-studio"
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
		delegatedDevelopers: getCountsForRole(CONSTANTS.DELEGATED_DEV_ROLE),
        sourceControlUsers: getCountsForRole(CONSTANTS.SOURCE_CONTROL_ROLE)
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
        buildName: gs.getProperty("glide.buildname"),
        buildTag: gs.getProperty("glide.buildtag")
    };

    if(gr.next()) {
        installationDetails.installed = true;
        installationDetails.installedOn = gr.getValue("install_date");
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
        installationDetails: getInstallationDetails(),
        developerRoles: getDeveloperRoles(),
        groupsWithAESRole: getGroupsWithRole()
    };

    gs.print(JSON.stringify(results));

})();