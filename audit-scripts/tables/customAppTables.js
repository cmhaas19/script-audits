
var getCompanyCode = function() {
	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return null;

	return companyCode;
};

var getCustomTables = function() {

    var tables = (function(){
        var gr = new GlideRecord("sys_db_object");
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_scope.scopeSTARTSWITHx_" + getCompanyCode());
        gr.query();

        var results = {};

        while(gr.next()) {
            var tableName = gr.getValue("name"),
                parentTableName = gr.super_class.name.toString(),
                autoNumberEnabled = (gr.number_ref.prefix != undefined && gr.number_ref.prefix != null && gr.number_ref.prefix.toString().length > 0);

            results[tableName] = { 
                label: gr.getValue("label"),
                createdOn: gr.getValue("sys_created_on"),
                scope: gr.sys_scope.scope.toString(),
                extendsTable: "", 
                extensible: (gr.getValue("is_extendable") == true),
                fieldTypes: {}, 
                referenceTables: {},
                fieldCount: 0
            };

            if(autoNumberEnabled) {
                results[tableName].autoNumber = {
                    prefix: gr.number_ref.prefix.toString(),
                    number: gr.number_ref.number.toString(),
                    maximumDigits: gr.number_ref.maximum_digits.toString()
                }
            }

            if(parentTableName && parentTableName.length)
                results[tableName].extendsTable = parentTableName;
        }

        return results;
    })();

    //
    // Field type info from sys_dictionary
    //
    (function(){
        var gr = new GlideAggregate("sys_dictionary");
        gr.addAggregate("COUNT");
        gr.groupBy("name");
        gr.groupBy("internal_type");
        gr.setWorkflow(false);
        gr.addEncodedQuery("nameIN" + Object.keys(tables).join(",") + "^internal_type!=collection^internal_type!=NULL");
        gr.addQuery("element", "NOT LIKE", "sys_%");
        gr.query();

        while(gr.next()) {
            var tableName = gr.name.toString(),
                fieldType = gr.internal_type.toString(),
                fieldTypeCount = parseInt(gr.getAggregate("COUNT"));

            var table = tables[tableName];
            table.fieldTypes[fieldType] = fieldTypeCount;
            table.fieldCount += fieldTypeCount;
        }
    })();

    //
    // Reference field info from sys_dictionary
    //
    (function(){
        var gr = new GlideAggregate("sys_dictionary");
        gr.addAggregate("COUNT");
        gr.groupBy("name");
        gr.groupBy("reference");
        gr.setWorkflow(false);
        gr.addEncodedQuery("nameIN" + Object.keys(tables).join(",") + "^internal_type=reference");
        gr.addQuery("element", "NOT LIKE", "sys_%");
        gr.query();

        while(gr.next()) {
            var tableName = gr.name.toString(),
                referenceTable = gr.reference.toString(),
                referenceCount = parseInt(gr.getAggregate("COUNT"));

            var table = tables[tableName];
            table.referenceTables[referenceTable] = referenceCount;
        }
    })();

    //
    // Overrides from sys_dictionary_override
    //
    (function(){
        var gr = new GlideRecord("sys_dictionary_override");
        gr.setWorkflow(false);
        gr.addEncodedQuery("nameIN" + Object.keys(tables).join(","));
        gr.query();

        var gru = new GlideRecordUtil();
        var fields = [];

        while(gr.next()) {
            var tableName = gr.name.toString();
            var table = tables[tableName];
            var override = {};

            if(table.overrides == undefined)
                table.overrides = [];

            if(fields.length == 0)
                fields = gru.getFields(gr).sort();

            for(var i = 0, length = fields.length; i < length;i++) {
                var field = fields[i];

                if(!field.startsWith("sys_"))
                    override[field] = gr.getValue(field);
            }

            table.overrides.push(override);
        }
    })();

    //
    // Count of fields marked 'Mandatory' in sys_dictionary    
    //
    (function(){
        var gr = new GlideAggregate("sys_dictionary");
        gr.addAggregate("COUNT");
        gr.groupBy("name");
        gr.setWorkflow(false);
        gr.addEncodedQuery("nameIN" + Object.keys(tables).join(",") + "^internal_type!=collection^ORinternal_type=NULL^mandatory=true^element!=number");
        gr.addQuery("element", "NOT LIKE", "sys_%");
        gr.query();

        while(gr.next()) {
            var table = tables[gr.name.toString()];

            if(table.mandatory == undefined)
                table.mandatory = {};

            table.mandatory.dictionary = parseInt(gr.getAggregate("COUNT"));
        }
    })();

    //
    // Count of fields marked 'Mandatory' in sys_data_policy_rule    
    //
    (function(){
        var gr = new GlideAggregate("sys_data_policy_rule");
        gr.addAggregate("COUNT");
        gr.groupBy("table");
        gr.setWorkflow(false);
        gr.addEncodedQuery("tableIN" + Object.keys(tables).join(",") + "^mandatory=true^field!=number");
        gr.addQuery("field", "NOT LIKE", "sys_%");
        gr.query();

        while(gr.next()) {
            var table = tables[gr.table.toString()];

            if(table.mandatory == undefined)
                table.mandatory = {};

            table.mandatory.dataPolicy = parseInt(gr.getAggregate("COUNT"));
        }
    })();

    return tables;
};

(function(){

	if(getCompanyCode() == null)
		return {};

	var auditResults = {
		customTables: getCustomTables()
	};

	gs.print(JSON.stringify(auditResults));

})();