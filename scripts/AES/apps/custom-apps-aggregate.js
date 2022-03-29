
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getCustomAppsByCreatedDate = function() {
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

var getAppsWithLogos = function() {
    var gr = new GlideAggregate("sys_app");
    gr.setWorkflow(false);
    gr.addEncodedQuery("scopeSTARTSWITHx_" + getCompanyCode() + "^logo!=");
    gr.addAggregate("COUNT");
    gr.query();

    return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
};

var getSourceControlledApps = function(){
    var gr = new GlideAggregate("sys_repo_config");
    gr.setWorkflow(false);
    gr.addEncodedQuery("sys_app.scopeSTARTSWITHx_" + getCompanyCode());
    gr.addJoinQuery("sys_app", "sys_app", "sys_id");
    gr.addAggregate("COUNT");
    gr.query();

    return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
};

(function() {

    var results = {
        companyCode: getCompanyCode(),
        appsByCreatedDate: getCustomAppsByCreatedDate(),
        sourceControlledApps: getSourceControlledApps(),
        appsWithLogos: getAppsWithLogos()
    };

    gs.print(JSON.stringify(results));

})();