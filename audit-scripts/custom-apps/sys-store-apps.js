
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getStoreApps = function(range) {
    var apps = {};

    var gr = new GlideRecord("sys_store_app");
    gr.setWorkflow(false);
    gr.chooseWindow(range.start, range.end);
    gr.addEncodedQuery("scopeSTARTSWITHx_" + getCompanyCode());
    gr.orderByDesc("sys_created_on");
    gr.query();

    while(gr.next()) {
        var appId = gr.getUniqueValue(),
            createdOn = gr.getValue("sys_created_on"),
            installedOn = "1970-01-01";

        if(!gr.install_date.nil())
            installedOn = new GlideDateTime(gr.getValue("install_date")).getDate().getValue()

        apps[appId] = {
            c: new GlideDateTime(createdOn).getDate().getValue(),
            i: installedOn
        }
    }

    return {
        totalApps: gr.getRowCount(),
        apps: apps
    };
};

(function() {

    var results = {
        companyCode: getCompanyCode(),
        customApps: {}
    };

    var ranges = {
        r1: { start: 0, end: 399 },
        r2: { start: 400, end: 799 },
        r3: { start: 800, end: 1199 },
        r4: { start: 1200, end: 1599 },
    };

    if(results.companyCode.length > 0) {
        results.customApps = getStoreApps(ranges.r1);
    }

    gs.print(JSON.stringify(results));

})();