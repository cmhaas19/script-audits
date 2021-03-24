
var isEmptyObject = function(obj) {
	return (Object.keys(obj).length === 0 && obj.constructor === Object);
};

var getScopes = function() {
	var scopes = {},
		companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return scopes;

	(function(){
		var gr = new GlideAggregate("sys_app");
		gr.setWorkflow(false);
		gr.addQuery("scope", "STARTSWITH", "x_" + companyCode);
		gr.addAggregate("COUNT");
		gr.groupBy("scope");
		gr.query();

		while(gr.next()){
			var scope = gr.scope.toString();

			if(scope != null && scope.length && scopes[scope] == undefined) {
				scopes[scope] = true;
			}
		}
	})();

	(function(){
		var gr = new GlideAggregate("sys_store_app");
		gr.setWorkflow(false);
		gr.addQuery("scope", "STARTSWITH", "x_" + companyCode);
		gr.addAggregate("COUNT");
		gr.groupBy("scope");
		gr.query();

		while(gr.next()){
			var scope = gr.scope.toString();

			if(scope != null && scope.length && scopes[scope] == undefined) {
				scopes[scope] = true;
			}
		}
	})();
	

	return scopes;
};

var getCustomAppArtifacts = function() {
	var artifacts = {};
	var scopes = getScopes();

	if(isEmptyObject(scopes))
		return {};

	var gr = new GlideAggregate("sys_metadata");
	gr.setWorkflow(false);
	gr.addAggregate("COUNT");
	gr.addEncodedQuery("sys_scope.scopeIN" + Object.keys(scopes).join(","));
	gr.groupBy("sys_scope");
	gr.groupBy("sys_class_name");
	gr.query();

	while(gr.next()){
		var count = parseInt(gr.getAggregate("COUNT")),
			scope = gr.sys_scope.scope.toString(),
			className = gr.sys_class_name.toString();

		if(artifacts[scope] == undefined)
			artifacts[scope] = {};

		if(artifacts[scope][className] == undefined)
			artifacts[scope][className] = 0;

		artifacts[scope][className] += count;
	}

	return artifacts;

};


(function(){

	var auditResults = {
		customAppArtifacts: getCustomAppArtifacts()
	};

	gs.print(JSON.stringify(auditResults));

})();