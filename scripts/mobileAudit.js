
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

    if(companyCode == undefined || companyCode == null || companyCode.length == 0)
        return null;
        
    return companyCode;
};

var excludedFields = [
    "query_condition_script", 
    "query_condition",
    "sys_update_name", 
    "sys_updated_by", 
    "sys_created_by",
    "sys_mod_count", 
    "sys_package", 
    "sys_policy", 
    "sys_tags"];

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

var getMobileData = function(){
    var companyCode = getCompanyCode();

    if(companyCode == null)
        return;

    var query = "sys_scope.scopeSTARTSWITHx_" + companyCode;
    var tables = {
        "sys_sg_native_client": "",
        "sys_sg_applet_launcher": query,
        "sys_sg_applet_launcher_m2m_section": query,
        "sys_sg_icon_section": query,
        "sys_sg_screen": query,
        "sys_sg_data_item": query
    };
    var results = {};

    for(table in tables){
        results[table] = getRecords(table, tables[table]);
    }

    return results;
};


(function(){

	var auditResults = {
        tableExists: GlideTableDescriptor.isValid("sys_sg_screen"),
        companyCode: getCompanyCode(),
		mobileData: getMobileData()
	};

	gs.print(JSON.stringify(auditResults));

})();