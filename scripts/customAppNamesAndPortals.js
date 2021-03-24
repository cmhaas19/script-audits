


var getCustomAppNames = function() {
	var customAppNames = {};
	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return customAppNames;

	(function(){
		var gr = new GlideRecord("sys_app");
		gr.setWorkflow(false);
		gr.setLimit(5000);
		gr.addEncodedQuery("scopeSTARTSWITHx_" + companyCode + "^active=true");
		gr.query();

		while(gr.next()){
			var appName = gr.getValue("name");

			if(customAppNames[appName] == undefined)
				customAppNames[appName] = 1;
		}
	})();

	(function(){
		var gr = new GlideRecord("sys_store_app");
		gr.setWorkflow(false);
		gr.setLimit(5000);
		gr.addEncodedQuery("scopeSTARTSWITHx_" + companyCode + "^active=true");
		gr.query();

		while(gr.next()){
			var appName = gr.getValue("name");

			if(customAppNames[appName] == undefined)
				customAppNames[appName] = 1;
		}
	})();

	return customAppNames;
};

var getCustomPortalNames = function() {
	var portalNames = {};

	var gr = new GlideRecord("sp_portal");

	if(!gr.isValid())
		return portalNames;

	gr.setWorkflow(false);
	gr.setLimit(5000);
	gr.query();

	while(gr.next()) {
		var scope = gr.sys_scope.scope.toString(),
			portalName = gr.getValue("title");

		if(scope.substring(0, 3) != "sn_" && portalNames[portalName] == undefined) {
			portalNames[portalName] = 1;
		}
	}

	return portalNames;

};


(function(){

	var auditResults = {
		customAppNames: getCustomAppNames(),
		customPortalNames: getCustomPortalNames()
	};

	gs.print(JSON.stringify(auditResults));

})();