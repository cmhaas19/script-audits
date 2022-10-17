
var getCompanyCode = function() {
	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return null;

	return companyCode;
};

var getCustomEvents = function(){
    var gr = new GlideRecord("sysevent_register");
    gr.setWorkflow(false);
    gr.addEncodedQuery("sys_scope.scopeSTARTSWITHx_" + getCompanyCode());
    gr.query();

    var results = [];

    while(gr.next()){

        results.push({ 
            scope: gr.sys_scope.scope.toString(),
            createdOn: gr.getValue("sys_created_on"),
            eventName: gr.getValue("event_name"),
            description: gr.getValue("description"),
            table: gr.getValue("table"),
            firedBy: gr.getValue("fired_by"),
            queue: gr.getValue("queue"),
            suffix: gr.getValue("suffix"),
            callerAccess: gr.getValue("caller_access")
        });
    }

    return results;
};


(function(){

	if(getCompanyCode() == null)
		return {};

	var auditResults = {
		customEvents: getCustomEvents()
	};

	gs.print(JSON.stringify(auditResults));

})();