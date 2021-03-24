
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

    if(companyCode == undefined || companyCode == null || companyCode.length == 0)
        return null;
        
    return companyCode;
};

var excludedFields = [
    "root_component_config",
    "inner_components",
    "internal_event_mappings",
    "script",
    "source_script",
    "required_translation_keys",
    "required_translations",
    "required_sys_props",
    "externals",
    "composition",
    "data",
    "props",
    "layout",
    "interactions",
    "events", 
    "state_properties"];

var isExcludedField = function(fieldName) {
    return (excludedFields.indexOf(fieldName) != -1);
};

var getRecords = function(table, query){
    var records = [];

    var gr = new GlideRecord(table);

    if(!gr.isValid())
        return records;

    gr.setWorkflow(false);
    gr.setLimit(5000);
    gr.addEncodedQuery(query);
    gr.query();

    var util = new GlideRecordUtil();
    var fieldList = [];

    while(gr.next()){
        var record = { scope: gr.sys_scope.scope.toString() };

        if(fieldList.length == 0)
            fieldList = util.getFields(gr).sort();

        for(var i = 0, fields = fieldList.length;i < fields;i++){
            var fieldName = fieldList[i];

            if(!isExcludedField(fieldName))
                record[fieldName] = gr.getValue(fieldName);
        }

        records.push(record);
    }

    return records;

};

var getComponentData = function(){
    var companyCode = getCompanyCode();

    if(companyCode == null)
        return;

    var query = "sys_scope.scopeSTARTSWITHx_" + companyCode;
    var tables = ["sys_ux_macroponent", "sys_ux_lib_component", "sys_uib_toolbox_component", "sys_ux_lib_source_script"];
    var results = {};

    tables.forEach(function(table){
        results[table] = getRecords(table, query);
    });

    return results;
};


(function(){

	var auditResults = {
        tableExists: GlideTableDescriptor.isValid("sys_ux_macroponent"),
        companyCode: getCompanyCode(),
		components: getComponentData()
	};

	gs.print(JSON.stringify(auditResults));

})();