
var getCompanyCode = function() {
	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return null;

	return companyCode;
};

var getCustomReports = function(){
    var gr = new GlideRecord("sys_report");
    gr.setWorkflow(false);
    gr.addEncodedQuery("sys_scope.scopeSTARTSWITHx_" + getCompanyCode());
    gr.query();

    var results = [];

    while(gr.next()){

        results.push({ 
            scope: gr.sys_scope.scope.toString(),
            createdOn: gr.getValue("sys_created_on"),
            title: gr.getValue("title"),
            description: gr.getValue("description"),
            table: gr.getValue("table"),
            field: gr.getValue("field"),
            fieldList: gr.getValue("field_list"),
            type: gr.getValue("type"),
            chartSize: gr.getValue("chart_size"),
            user: gr.getValue("user"),
            filter: gr.getValue("filter"),
            roles: gr.getValue("roles"),
            isScheduled: (gr.getValue("is_scheduled") == "1")
        });
    }

    return results;
};


(function(){

	if(getCompanyCode() == null)
		return {};

	var auditResults = {
		customReports: getCustomReports()
	};

	gs.print(JSON.stringify(auditResults));

})();