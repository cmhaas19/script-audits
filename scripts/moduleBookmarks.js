
var bookMarkAudit = (function() {

	var getUsersWithRole = function(roleName) {
		var users = new GlideRecord("sys_user_has_role");
		users.setWorkflow(false);
		users.addEncodedQuery("user.active=true^role.name=" + roleName);
		users.setLimit(1000);
		users.query();

		var userIds = [];

		while(users.next()){
			userIds.push(users.getValue("user"));
		}

		return userIds;
	};

	var getModuleBookmarks = function(userIds) {
		var gr = new GlideRecord("sys_ui_bookmark");
		gr.setWorkflow(false);
		gr.addEncodedQuery("moduleISNOTEMPTY^urlLIKE_list.do^userIN" + userIds);
		gr.query();

		var results = {
			totalUsers: userIds.length,
			bookmarks: {}
		};

		while(gr.next()){
			var module = gr.getValue("module"),
				moduleName = gr.module.getDisplayValue(),
				applicationName = gr.module.application.getDisplayValue();

			var bookmark = applicationName + " > " + moduleName;

			if(results.bookmarks[bookmark] == undefined)
				results.bookmarks[bookmark] = 0;

			results.bookmarks[bookmark]++;
		}

		return results;
	};

	var execute = function() {
		var itilUsers = getUsersWithRole("itil");

		var returnValue = {
			itilModuleBookmarks: getModuleBookmarks(itilUsers)
		};

		if(pm.isRegistered("com.sn_customerservice")) {

			var csmUsers = getUsersWithRole("sn_customerservice_agent");

			returnValue.csmModuleBookmarks = getModuleBookmarks(csmUsers);
		}

		return returnValue;

	};

	return {
		execute: execute
	};

})();


var usageAudit = function(tableName) {

	var getTransactionStats = function(daysAgo) {

		var gr = new GlideAggregate(tableName);
		gr.addEncodedQuery("sys_created_onRELATIVEGT@dayofweek@ago@" + daysAgo);
		gr.addAggregate('COUNT');
		gr.setWorkflow(false);
		gr.query();

		return (gr.next() ? gr.getAggregate("COUNT") : 0);
	};

	var execute = function() {
		return {
			"30": getTransactionStats(30),
			"90": getTransactionStats(90),
			"180": getTransactionStats(180),
			"365": getTransactionStats(365)
		};
	};

	return {
		execute: execute
	};
	
};

var dualRoleAudit = (function() {

	var getRoleCount = function(roleName) {
		var gr = new GlideAggregate("sys_user_has_role");
		gr.setWorkflow(false);
		gr.addEncodedQuery("user.active=true^inherited=false^role.name=" + roleName);
		gr.addAggregate("COUNT");
		gr.query();

		return (gr.next() ? gr.getAggregate("COUNT") : 0);
	};

	var getDualCitizenship = function() {
		var gr = new GlideAggregate("sys_user_has_role");
		gr.setWorkflow(false);
		gr.addEncodedQuery("user.active=true^inherited=false^role.name=itil^ORrole.name=sn_customerservice_agent");
		gr.addAggregate("COUNT");
		gr.groupBy("user");
		gr.addHaving('COUNT', '>', '1');
		gr.query();

		return gr.getRowCount();
	};

	var execute = function() {
		return {
			itilUsers: getRoleCount("itil"),
			csmUsers: getRoleCount("sn_customerservice_agent"),
			dualUsers: getDualCitizenship()
		};
	};

	return {
		execute: execute
	};

})();


var returnValue = {
	bookmarks: bookMarkAudit.execute(),
	outageUsage: usageAudit("cmdb_ci_outage").execute(),
	dualRoles: dualRoleAudit.execute()
};

gs.print(JSON.stringify(returnValue));
