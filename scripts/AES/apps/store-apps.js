
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getStoreApps = function() {
    var gr = new GlideRecord("sys_store_app");
    gr.setWorkflow(false);
    gr.setLimit(600);
    gr.addEncodedQuery("scopeSTARTSWITHx_" + getCompanyCode());
    gr.orderByDesc("sys_created_on");
    gr.query();

    var apps = {};

    while(gr.next()) {
        var value = gr.getValue("install_date");

        if(value && value != null && value.length > 0)
            apps[gr.getUniqueValue()] = new GlideDateTime(value).getDate().getValue();
        else
            apps[gr.getUniqueValue()] = false;
    }

    return apps;
};

(function() {

    var results = {
        storeApps: getStoreApps()
    };

    gs.print(JSON.stringify(results));

})();