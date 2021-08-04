
var getCompanyCode = function() {
	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return null;

	return companyCode;
}

var getCustomAppArtifacts = function() {
	var gr = new GlideAggregate("sys_metadata");
	gr.setWorkflow(false);
	gr.addAggregate("COUNT");
	gr.addEncodedQuery("sys_scope.scopeSTARTSWITHx_" + getCompanyCode());
	gr.groupBy("sys_scope");
	gr.groupBy("sys_class_name");
	gr.query();

	var artifacts = {};
	var artifactKeys = {};
	var keyIndex = 0;

	while(gr.next()){
		var count = parseInt(gr.getAggregate("COUNT")),
			scope = gr.sys_scope.scope.toString(),
			createdOn = gr.sys_scope.sys_created_on.toString(),
			className = gr.sys_class_name.toString();

		if(artifacts[scope] == undefined){
			artifacts[scope] = { 
				createdOn: createdOn,
				artifacts: {}
			};
		}

		//
		// Get or generate an artifact key
		//
		var artifactKey = artifactKeys[className];

		if(artifactKey == undefined){
			keyIndex += 1;
			artifactKeys[className] = keyIndex;
			artifactKey = keyIndex;
		}

		var app = artifacts[scope];

		//
		// Now store the data using the key (reduces payload size)
		//
		if(app.artifacts[artifactKey] == undefined)
			app.artifacts[artifactKey] = 0;

		app.artifacts[artifactKey] += count;
	}

	return {
		artifacts: artifacts,
		artifactKeys: artifactKeys
	};
};

(function(){

	if(getCompanyCode() == null)
		return {};

	var auditResults = {
		customAppArtifacts: getCustomAppArtifacts()
	};

	gs.print(JSON.stringify(auditResults));

})();