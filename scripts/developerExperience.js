
var isEmptyObject = function(obj) {
	return (Object.keys(obj).length === 0 && obj.constructor === Object);
};

var getCustomTables = function(scopes, dateQuery) {

	if(dateQuery == undefined)
		dateQuery = "";

	var getTableStats = function(query) {
		var stats = {
			tableCount: 0,
			tableExtensions: {}
		};

		var gr = new GlideAggregate("sys_db_object");
		gr.setWorkflow(false);
		gr.addAggregate("COUNT");
		gr.addEncodedQuery(query);
		gr.groupBy("super_class");
		gr.query();

		while(gr.next()) {
			var count = parseInt(gr.getAggregate("COUNT"));
			var parentTable = gr.super_class.name.toString();

			stats.tableCount += count;

			if(parentTable != null && parentTable.length)
				stats.tableExtensions[parentTable] = count;
		}

		return stats;
	};

	var query = "sys_created_by!=system^super_class.nameNOT LIKEsys_import_set_row^super_class.nameNOT LIKEsyslog^super_class.nameNOT LIKEsys_metadata" + dateQuery;

	var results = {
		globalTables: getTableStats("nameSTARTSWITHu_^" + query)
	};

	if(!isEmptyObject(scopes))
		results.scopedTables = getTableStats("nameSTARTSWITH" + Object.keys(scopes).join("^ORnameSTARTSWITH") + "^" + query);

	return results;
};

var getCustomTableColumnStats = function(scopes) {

	var customTables = (function() {
		var query = "nameSTARTSWITHu_";

		if(!isEmptyObject(scopes))
			query += "^ORnameSTARTSWITH" + Object.keys(scopes).join("^ORnameSTARTSWITH");

		query += "^sys_created_by!=system^super_class.nameNOT LIKEsys_import_set_row^super_class.nameNOT LIKEsyslog^super_class.nameNOT LIKEsys_metadata";

		var gr = new GlideRecord("sys_db_object");
		gr.setWorkflow(false);
		gr.addEncodedQuery(query);
		gr.query();

		var tables = {};

		while(gr.next()) {
			var name = gr.getValue("name"),
				parent = gr.super_class.name.toString()

			tables[name] = parent;
		}

		return tables;

	})();

	var results = {
		nonExtendedTables: [],
		extendedTables: {}
	};

	for(var table in customTables) {
		var tableName = table,
			parentTableName = customTables[table];

		var gr = new GlideAggregate("sys_dictionary");
		gr.setWorkflow(false);
		gr.addAggregate("COUNT");
		gr.groupBy("name");
		gr.addEncodedQuery("internal_type!=collection^elementNOT INsys_id,sys_created_by,sys_created_on,sys_mod_count,sys_updated_by,sys_updated_on");
		var qc = gr.addQuery("name", table);

		if(parentTableName && parentTableName.length)
			qc.addOrCondition("name", "=", parentTableName);

		gr.query();

		while(gr.next()) {
			var name = gr.name.toString(),
				columnCount = parseInt(gr.getAggregate("COUNT"));

			if(!parentTableName.length) {
				results.nonExtendedTables.push(columnCount);
			} else {
				if(results.extendedTables[parentTableName] == undefined)
					results.extendedTables[parentTableName] = { baseCount: 0, columnCounts: [] };

				if(name == tableName) {
					results.extendedTables[parentTableName].columnCounts.push(columnCount);
				} else {
					results.extendedTables[parentTableName].baseCount = columnCount;
				}
			}
		}
	}

	return results;

};

var getScopes = function() {
	var scopes = {};

	var gr = new GlideRecord("sys_app");
	gr.setWorkflow(false);
	gr.addEncodedQuery("vendor_prefix=NULL^active=true");
	gr.query();

	while(gr.next()){
		var scope = gr.getValue("scope");

		if(scope != null && scope.length && scope != "global" && scopes[scope] == undefined) {
			scopes[scope] = true;
		}		
	}

	return scopes;
};

var getCrossScopeStats = function(scopes) {

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


var getCustomApps = function(query) {
	var apps = {
		scopedCount: 0,
		globalCount: 0
	};

	var gr = new GlideRecord("sys_app");
	gr.setWorkflow(false);
	gr.addEncodedQuery(query);
	gr.query();

	while(gr.next()){
		var scope = gr.getValue("scope");

		if(scope != null && scope.length) {
			if(scope == "global") {
				apps.globalCount++;
			}
			else {
				apps.scopedCount++;
			}
		}		
	}

	return apps;
};

var getCustomAppArtifacts = function(scopes) {
	var artifacts = {};

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

	var scopes = getScopes();

	var auditResults = {
		apps: getCustomApps("vendor_prefix=NULL^active=true"),
		appsLastYear: getCustomApps("vendor_prefix=NULL^active=true^sys_created_onRELATIVEGE@year@ago@1"),
		customTables: getCustomTables(scopes),
		customTablesLastYear: getCustomTables(scopes, "^sys_created_onRELATIVEGE@year@ago@1"),
		customTableColumns: getCustomTableColumnStats(scopes),
		crossScopeStats: getCrossScopeStats(scopes),
		customAppArtifacts: getCustomAppArtifacts(scopes)
	};

	gs.print(JSON.stringify(auditResults));

})();