
var getCompanyCode = function() {
	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return null;

	return companyCode;
}

var getCurrentLanguage = function() {
	var language = "N/A";
	try {
		language = gs.getSession().getLanguage()
	} catch(e) {}

	return language;
}

var getMetaDataTables = function() {
	var gr = new GlideRecord("sys_db_object");
	gr.setWorkflow(false);

	var metaDataJoin = gr.addJoinQuery("sys_metadata", "name", "sys_class_name");
	metaDataJoin.addCondition("sys_scope.scope", "STARTSWITH", "x_" + getCompanyCode());

	gr.query();

	var tables = {};

	while(gr.next()){
		var name = gr.getValue("name"),
			label = gr.getValue("label"),
			packageName = gr.sys_package.getDisplayValue();

		tables[name] = { 
			label: label,
			packageName: packageName
		};
	}

	return tables;
};

var getArtifactPackages = function() {
	var gr = new GlideAggregate("sys_metadata");
	gr.setWorkflow(false);
	gr.addAggregate("COUNT");
	gr.addEncodedQuery("sys_scope.scopeSTARTSWITHx_" + getCompanyCode());
	gr.groupBy("sys_class_name");
	gr.query();

	var tableDetails = {};
	var tables = getMetaDataTables();

	while(gr.next()){
		var className = gr.sys_class_name.toString();
		var table = tables[className];

		if(table != undefined) {
			tableDetails[className] = {
				pkg: table.packageName,
				lbl: table.label
			}
		}
	}

	return tableDetails;
};

(function(){

	if(getCompanyCode() == null)
		return {};

	var auditResults = {
		currentLanguage: getCurrentLanguage(),
		artifactPackages: getArtifactPackages()
	};

	gs.print(JSON.stringify(auditResults));

})();