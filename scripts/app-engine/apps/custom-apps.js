
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getCustomApps = function() {
    var apps = [];

    var gr = new GlideRecord("sys_app");
    gr.setWorkflow(false);
    gr.setLimit(850);
    gr.addEncodedQuery("scopeSTARTSWITHx_" + getCompanyCode());
    gr.orderByDesc("sys_created_on");
    gr.query();

    while(gr.next()) {
        apps.push(gr.getUniqueValue());
    }

    return apps;
};

(function() {

    var results = {
        companyCode: getCompanyCode(),
        customApps: getCustomApps()
    };

    gs.print(JSON.stringify(results));

})();