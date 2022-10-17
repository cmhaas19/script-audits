
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

var getCrossScopeStats = function() {
	var scopes = getScopes();

	if(isEmptyObject(scopes))
		return {};
	
	var getScopeAccess = function(query) {
		var scopeAccess = {};

		var gr = new GlideAggregate("sys_scope_privilege");
		gr.setWorkflow(false);
		gr.addEncodedQuery(query);
		gr.addAggregate("COUNT");
		gr.groupBy("source_scope");
		gr.groupBy("operation");
		gr.query();

		while(gr.next()) {
			var count = parseInt(gr.getAggregate("COUNT")),
				scope = gr.source_scope.scope.toString(),
				operation = gr.operation.toString();

			if(scopeAccess[scope] == undefined)
				scopeAccess[scope] = {};

			scopeAccess[scope][operation] = count;
		}

		return scopeAccess;
	};

	var inScopes = Object.keys(scopes).join(",");

	return {
		globalAccess: getScopeAccess("target_scope=global^source_scope.scopeIN" + inScopes),
		crossScopeAccess: getScopeAccess("target_scope.scopeIN" + inScopes + "^source_scope.scopeIN" + inScopes)
	}
};


var getCustomApps = function() {

	var getApps = function(query) {

		var localApps = (function(){
			var gr = new GlideAggregate("sys_app");
			gr.setWorkflow(false);
			gr.addEncodedQuery(query);
			gr.addAggregate("COUNT");
			gr.query();

			return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
		})();

		var storeApps = (function(){
			var gr = new GlideAggregate("sys_store_app");
			gr.setWorkflow(false);
			gr.addEncodedQuery(query);
			gr.addAggregate("COUNT");
			gr.query();

			return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
		})();

		return (localApps + storeApps);
	};

	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return {};

	return {
		scopedCount: getApps("scopeSTARTSWITHx_" + companyCode + "^active=true"),
		scopedCountLastYear: getApps("scopeSTARTSWITHx_" + companyCode + "^active=true^sys_created_onRELATIVEGE@year@ago@1"),
		globalCount: getApps("scope=global^vendor_prefix=NULL^active=true"),
		globalCountLastYear: getApps("scope=global^vendor_prefix=NULL^active=true^sys_created_onRELATIVEGE@year@ago@1")
	};

};


(function(){

	var auditResults = {
		apps: getCustomApps(),
		crossScopeStats: getCrossScopeStats()
	};

	gs.print(JSON.stringify(auditResults));

})();