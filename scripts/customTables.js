
var isEmptyObject = function(obj) {
	return (Object.keys(obj).length === 0 && obj.constructor === Object);
};

var getCustomTableStats = function() {
	var results = {};
	var scopes = getScopes();
	var baseQuery = "sys_created_by!=system^super_class.nameNOT LIKEsys_import_set_row^ORsuper_classISEMPTY^super_class.nameNOT LIKEsyslog^ORsuper_classISEMPTY^super_class.nameNOT LIKEsys_metadata^ORsuper_classISEMPTY";
	var dateQuery = "sys_created_onRELATIVEGE@year@ago@1";

	var getCustomTableCounts = function(query) {
		var gr = new GlideAggregate("sys_db_object");
		gr.setWorkflow(false);
		gr.addAggregate("COUNT");
		gr.addEncodedQuery(query);
		gr.query();

		return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
	};

	(function(){
		if(!isEmptyObject(scopes)) {
			var baseScopeQuery = "nameSTARTSWITH" + Object.keys(scopes).join("^ORnameSTARTSWITH");

			results.scopedCount = getCustomTableCounts(baseScopeQuery + "^" + baseQuery);
			results.scopedCountLastYear = getCustomTableCounts(baseScopeQuery + "^" + baseQuery + "^" + dateQuery);
		}

		results.globalCount = getCustomTableCounts("nameSTARTSWITHu_"+ "^" + baseQuery);
		results.globalCountLastYear = getCustomTableCounts("nameSTARTSWITHu_" + "^" + baseQuery + "^" + dateQuery);

	})();
	

	results.tables = (function() {
		var query = baseQuery + "^nameSTARTSWITHu_";
		var tableList = {};

		if(!isEmptyObject(scopes))
			query += "^ORnameSTARTSWITH" + Object.keys(scopes).join("^ORnameSTARTSWITH");

		var gr = new GlideRecord("sys_db_object");
		gr.setWorkflow(false);
		gr.addEncodedQuery(query);
		gr.query();

		while(gr.next()) {
			var tableName = gr.getValue("name"),
				parentTableName = gr.super_class.name.toString(),
				autoNumberEnabled = (gr.number_ref.prefix != undefined && gr.number_ref.prefix != null && gr.number_ref.prefix.toString().length > 0);

			tableList[tableName] = { 
				extendsTable: "", 
				fieldTypes: {}, 
				fieldCount: 0, 
				isExtendable: (gr.getValue("is_extendable") == true)
			};

			if(autoNumberEnabled) {
				tableList[tableName].autoNumber = {
					prefix: gr.number_ref.prefix.toString(),
					number: gr.number_ref.number.toString(),
					maximumDigits: gr.number_ref.maximum_digits.toString()
				}
			}

			if(parentTableName && parentTableName.length)
				tableList[tableName].extendsTable = parentTableName;
		}

		return tableList;

	})();

	var gr = new GlideAggregate("sys_dictionary");
	gr.addAggregate("COUNT");
	gr.groupBy("name");
	gr.groupBy("internal_type");
	gr.setWorkflow(false);
	gr.addEncodedQuery("nameIN" + Object.keys(results.tables).join(",") + "^internal_type!=collection^elementNOT INsys_id,sys_created_by,sys_created_on,sys_mod_count,sys_updated_by,sys_updated_on");
	gr.query();

	while(gr.next()) {
		var tableName = gr.name.toString(),
			fieldType = gr.internal_type.toString(),
			fieldTypeCount = parseInt(gr.getAggregate("COUNT"));

		var table = results.tables[tableName];
		table.fieldTypes[fieldType] = fieldTypeCount;
		table.fieldCount += fieldTypeCount;
	}

	return results;

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


(function(){

	var auditResults = {
		customTables: getCustomTableStats()
	};

	gs.print(JSON.stringify(auditResults));

})();