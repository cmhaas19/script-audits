
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getAESAppCount = function() {
    var gr = new GlideAggregate("sys_app_template_output_var_instance");
    var apps = {};

    if(!gr.isValid())
        return 0;

    gr.setWorkflow(false);
    gr.addEncodedQuery("name=app_sys_id^template_instance.app_template=true^template_instance.state=complete^valueNOT LIKEstep");
    gr.addTrend("sys_created_on", 'Month');
    gr.addAggregate("COUNT");
    gr.setGroup(false);
    gr.query();
    
    while(gr.next()){
        apps[gr.getValue("timeref")] = parseInt(gr.getAggregate("COUNT"));
    }

    return apps;
};

var getSysAppCount = function() {
    var apps = {};

    var gr = new GlideAggregate("sys_app");
    gr.setWorkflow(false);
    gr.addEncodedQuery("scopeSTARTSWITHx_" + getCompanyCode());
    gr.addTrend("sys_created_on", 'Month');
    gr.addAggregate("COUNT");
    gr.setGroup(false);
    gr.query();

    while(gr.next()){
        apps[gr.getValue("timeref")] = parseInt(gr.getAggregate("COUNT"));
    }

    return apps;
};

var getSysStoreAppCount = function() {
    var apps = {};
    
    var gr = new GlideAggregate("sys_store_app");
    gr.setWorkflow(false);
    gr.addEncodedQuery("scopeSTARTSWITHx_" + getCompanyCode());
    gr.addTrend("sys_created_on", 'Month');
    gr.addAggregate("COUNT");
    gr.setGroup(false);
    gr.query();

    while(gr.next()){
        apps[gr.getValue("timeref")] = parseInt(gr.getAggregate("COUNT"));
    }

    return apps;
};


(function() {

    var combined = {};

    var addMonth = function(month){
        if(combined[month] == undefined)
            combined[month] = { aes: 0, app: 0, sApp: 0 };
        return combined[month];
    };

    (function(){
        var apps = getAESAppCount();

        for(var month in apps) {
            addMonth(month).aes += apps[month];
        }

    })();

    (function(){
        var apps = getSysAppCount();

        for(var month in apps) {
            addMonth(month).app += apps[month];
        }

    })();

    (function(){
        var apps = getSysStoreAppCount();

        for(var month in apps) {
            addMonth(month).sApp += apps[month];
        }

    })();

    var results = {
        companyCode: getCompanyCode(),
        apps: combined
    };

    gs.print(JSON.stringify(results));

})();