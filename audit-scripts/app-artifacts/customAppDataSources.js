
var getCompanyCode = function() {
	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return null;

	return companyCode;
};

var getCustomDataSources = function(){
    var gr = new GlideRecord("sys_data_source");
    gr.setWorkflow(false);
    gr.addEncodedQuery("sys_scope.scopeSTARTSWITHx_" + getCompanyCode());
    gr.query();

    var results = [];

    while(gr.next()){

        results.push({ 
            scope: gr.sys_scope.scope.toString(),
            createdOn: gr.getValue("sys_created_on"),
            tableName: gr.getValue("import_set_table_name"),
            filePath: gr.getValue("file_path"),
            fileRetrievalMethod: gr.getValue("file_retrieval_method"),
            format: gr.getValue("format"),
            name: gr.getValue("name"),
            sheetNumber: gr.getValue("sheet_number"),
            type: gr.getValue("type"),
            zipped: gr.getValue("zipped")
        });
    }

    return results;
};


(function(){

	if(getCompanyCode() == null)
		return {};

	var auditResults = {
		customDataSources: getCustomDataSources()
	};

	gs.print(JSON.stringify(auditResults));

})();