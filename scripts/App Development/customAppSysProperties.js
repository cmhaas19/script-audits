
var getCompanyCode = function() {
	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return null;

	return companyCode;
};

var getCustomSystemProperties = function(){
    var gr = new GlideRecord("sys_properties");
    gr.setWorkflow(false);
    gr.addEncodedQuery("sys_scope.scopeSTARTSWITHx_" + getCompanyCode());
    gr.query();

    var results = {};

    while(gr.next()) {
        var name = gr.getValue("name");

        results[name] = { 
            description: gr.getValue("description"),
            createdOn: gr.getValue("sys_created_on"),
            scope: gr.sys_scope.scope.toString(),
            value: gr.getValue("value"),
            type: gr.getValue("type")
        };
    }

    return results;
};


(function(){

	if(getCompanyCode() == null)
		return {};

	var auditResults = {
		customSystemProperties: getCustomSystemProperties()
	};

	gs.print(JSON.stringify(auditResults));

})();