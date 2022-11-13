
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getCustomApps = function(range) {
    var apps = {};

    var gr = new GlideRecord("sys_app");
    gr.setWorkflow(false);
    gr.chooseWindow(range.start, range.end);
    gr.addEncodedQuery("scopeSTARTSWITHx_" + getCompanyCode());
    gr.orderByDesc("sys_created_on");
    gr.query();

    while(gr.next()) {
        var appId = gr.getUniqueValue(),
            createdOn = gr.getValue("sys_created_on");

        apps[appId] = new GlideDateTime(createdOn).getDate().getValue();
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
        r1: { start: 0, end: 549 },
        r2: { start: 550, end: 1099 },
        r3: { start: 1100, end: 1649 },
        r4: { start: 1650, end: 2199 },
    };

    if(results.companyCode.length > 0) {
        results.customApps = getCustomApps(ranges.r1);
    }

    gs.print(JSON.stringify(results));

})();