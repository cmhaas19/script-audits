
var getCompanyCode = function() {
	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return null;

	return companyCode;
};
var getStringLength = function(text) {
    var length = 0;

    if(text != undefined && text != null){
        length = text.toString().length;
    }

    return length;
};

var getResults = function(){
    var gr = new GlideRecord("sysauto_script");
    gr.setWorkflow(false);
    gr.addEncodedQuery("sys_scope.scopeSTARTSWITHx_" + getCompanyCode());
    gr.query();

    var results = [];

    while(gr.next()){

        results.push({ 
            scope: gr.sys_scope.scope.toString(),
            createdOn: gr.getValue("sys_created_on"),
            name: gr.getValue("name"),
            conditional: (gr.getValue("conditional") == "1"),
            scriptConditionLength: getStringLength(gr.getValue("condition")),
            scriptLength: getStringLength(gr.getValue("script")),
            runAs: gr.getValue("run_as"),
            runAsValue: gr.run_as.getDisplayValue(),
            runType: gr.getValue("run_type"),
            repeatInterval: {
                dayOfMonth: gr.getValue("run_dayofmonth"),
                dayOfWeek: gr.getValue("run_dayofweek"),
                period: gr.getValue("run_period"),
                startDate: gr.getValue("run_start"),
                startTime: gr.getValue("run_time")
            }
        });
    }

    return results;
};


(function(){

	if(getCompanyCode() == null)
		return {};

	var auditResults = {
		customScheduledScripts: getResults()
	};

	gs.print(JSON.stringify(auditResults));

})();