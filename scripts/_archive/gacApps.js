
var getNewYorkAppData = function() {

	var buildVersion = (function(){
		return gs.getProperty("glide.buildtag");
	})();

	var upgradeDate = (function(){

		var gr = new GlideAggregate("sys_upgrade_history");
		gr.setWorkflow(false);
		gr.addEncodedQuery("to_versionLIKEnewyork^ORto_versionLIKEorlando^ORto_versionLIKEparis^ORto_versionLIKEquebec^ORto_versionLIKErome");
		gr.addAggregate("MIN", "upgrade_finished");
		gr.query();

		return gr.next() ? gr.getAggregate("MIN", "upgrade_finished") : null;

	})();

	var totalAppCounts = (function(){
		var appCounts = 0;

		var gr = new GlideAggregate("sys_app");
		gr.setWorkflow(false);
		gr.addAggregate("COUNT");
		gr.query();

		if(gr.next())
			appCounts = parseInt(gr.getAggregate("COUNT"));

		return appCounts;
	})();

	var gacAppCounts = (function(){
		var appCounts = 0;

		if(upgradeDate != null) {
			var gr = new GlideAggregate("sys_app");
			gr.setWorkflow(false);
			gr.addQuery("sys_created_on", ">=", upgradeDate);
			gr.addAggregate("COUNT");
			gr.query();

			if(gr.next())
				appCounts = parseInt(gr.getAggregate("COUNT"));
		}

		return appCounts;
	})();


	return {
		buildVersion: buildVersion,
		upgradeDate: upgradeDate,
		gacAppCounts: gacAppCounts,
		totalAppCounts: totalAppCounts
	}

};


var getGACSettings = function() {

	return {
		pluginActive: pm.isRegistered("com.glide.sn-guided-app-creator"),
		legacyEnabled: (gs.getProperty("sn_g_app_creator.use.legacy.appcreator", "false") == "true"),
		globalAppsEnabled: (gs.getProperty("sn_g_app_creator.allow_global", "false") == "true")
	};
};


(function(){

	var auditResults = {
		appData: getNewYorkAppData(),
		gacSettings: getGACSettings()
	};

	gs.print(JSON.stringify(auditResults));

})();