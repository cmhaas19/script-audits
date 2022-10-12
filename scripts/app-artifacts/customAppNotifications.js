
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

    if(companyCode == undefined || companyCode == null || companyCode.length == 0)
        return null;
        
    return companyCode;
};

var excludeValueFields = [
    "digest_separator_html",
    "digest_separator_text",
    "digest_text",
    "condition",
    "advanced_layout",
    "message",
    "message_html", 
    "message_text", 
    "subject",
    "message_list"
];

var excludedFields = [
    "sys_class_name",
    "collection",
    "sys_domain",
    "sys_domain_path",
    "sys_created_by",
    "sys_mod_count", 
    "sys_overrides",
    "sys_update_name",
    "sys_updated_by",
    "sys_version",
    "sys_package", 
    "sys_policy", 
    "sys_tags",
    "sys_scope"];

var isExcludedField = function(fieldName) {
    return (excludedFields.indexOf(fieldName) != -1);
};

var isExcludedValueField = function(fieldName) {
    return (excludeValueFields.indexOf(fieldName) != -1);
};

var fieldHasValue = function(fieldValue) {
    return (fieldValue != undefined && fieldValue != null && fieldValue.toString().trim().length > 0)
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

            if(isExcludedValueField(fieldName)) {
                record[fieldName] = fieldHasValue(gr.getValue(fieldName));
            } else if(!isExcludedField(fieldName)) {
                record[fieldName] = gr.getValue(fieldName);
            }
        }

        records.push(record);
    }

    return records;

};

var getTableData = function(){
    var companyCode = getCompanyCode();

    if(companyCode == null)
        return;

    var query = "sys_scope.scopeSTARTSWITHx_" + companyCode;
    var tables = {
        "sysevent_email_action": query,
        "sysevent_email_template": query,
        "sys_email_layout": query
    };
    var results = {};

    for(table in tables){
        results[table] = getRecords(table, tables[table]);
    }

    return results;
};


(function(){

	var auditResults = {
        companyCode: getCompanyCode(),
		tableData: getTableData()
	};

	gs.print(JSON.stringify(auditResults));

})();