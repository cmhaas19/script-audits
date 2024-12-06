
var CONSTANTS = {
    STUDIO_SCOPE: "sn_sns"
};


var getApplicationUsage = function() {
    var appUsage = {};
    var appNames = [
        'ServiceNow Studio',
        'ServiceNow IDE',
        'App Generation',
        'App Engine Studio',
        'UI Builder',
        'Creator Studio',
        'Workflow Studio',
        'Mobile App Builder',
        'Table Builder',
        'Table Builder for App Engine',
        'App Engine Management Center',
        'Studio',
        'Workspace Builder',
        'Workspace Builder for App Engine',
        'PDF Extractor'       
    ];

    var gr = new GlideAggregate("ua_app_usage");
    if(!gr.isValid())
        return appUsage;

    gr.setWorkflow(false);	
	gr.addEncodedQuery("app_nameIN" + appNames.join(","));
    gr.addAggregate("COUNT");
    gr.groupBy("app_name");
    gr.groupBy("time_stamp");
    gr.query();

    while(gr.next()) {
        var appName = gr.app_name.toString(),
            accrualPeriod = gr.time_stamp.toString(),
            count = parseInt(gr.getAggregate("COUNT"));

        if(appUsage[appName] == undefined)
            appUsage[appName] = {};

        appUsage[appName][accrualPeriod] = count;
    }

    return appUsage;
};

var getInstallationDetails = function() {    
    var gr = new GlideRecord("sys_store_app");
    gr.addQuery("scope=" + CONSTANTS.STUDIO_SCOPE);
    gr.query();

    var installationDetails = {
        installed: false,
        installedOn: "",
        version: ""
    };

    if(gr.next()) {
        var installDate = gr.getValue("install_date");

        installationDetails.installed = true;
        installationDetails.installedOn = (installDate && installDate != null ? new GlideDateTime(installDate).getDate().getValue() : "");
        installationDetails.version = gr.getValue("version");
    }

    return installationDetails;
};

var getSystemPropertySettings = function() {
    var gr = new GlideRecord("sys_properties");
    gr.setWorkflow(false);
    gr.setLimit(30);
    gr.addEncodedQuery("sys_scope.name=ServiceNow Studio");
    gr.query();

    var results = {};

    while(gr.next()){
        results[gr.getValue("name")] = gr.getValue("value");
    }

    return results;
};

var setSessionLanguage = function() {
    try {
        gs.getSession().setLanguage("en");
    } catch(e) { }
};

var getStudioUserCounts = function() {
    var gr = new GlideAggregate("sys_user_has_role");
    gr.setWorkflow(false);
    gr.addEncodedQuery("user.active=true^role.nameINadmin,delegated_developer");
    gr.groupBy("role");
    gr.addAggregate("COUNT");
    gr.query();

    var roles = {};

    while(gr.next()) {
        var roleName = gr.role.name.toString();

        roles[roleName] = parseInt(gr.getAggregate("COUNT"));
    }

    return roles;
};

var getAppCounts = function() {
    var gr = new GlideAggregate('sys_scope');
    gr.setWorkflow(false);
    gr.addAggregate('COUNT');
    gr.addEncodedQuery("sys_class_name=sys_store_app^scopeSTARTSWITHx_^ORscope=global^ORscopeISEMPTY^NQsys_class_name=sys_app");
    gr.groupBy("ide_created");
    gr.query();

    var results = {};

    while(gr.next()) {
        var ide = gr.ide_created.toString();
        var count = parseInt(gr.getAggregate("COUNT"));

        if(results[ide] == undefined)
            results[ide] = 0;

        results[ide] += count;
    }

    return results;
};

var getPipelineStats = function() {
    var pipelines = {
        installed: false,
        totalPipelines: 0,
        totalEnvironments: 0
    };

    (function(){
        var gr = new GlideRecord("sys_store_app");
        gr.addQuery("scope=sn_deploy_pipeline");
        gr.query();

        pipelines.installed = gr.next();
    })();

    (function(){
        var gr = new GlideAggregate("sn_pipeline_pipeline");

        if(!gr.isValid()) 
            return;

        gr.setWorkflow(false);
        gr.addAggregate("COUNT");
        gr.query();

        pipelines.totalPipelines = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

    })();

    (function(){
        var gr = new GlideAggregate("sn_pipeline_pipeline_environment_order");

        if(!gr.isValid())
            return;
            
        gr.setWorkflow(false);
        gr.addAggregate("COUNT");
        gr.query();

        pipelines.totalEnvironments = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
    })();
    
    return pipelines;
};

var getUserPreferences = function() {
    var gr = new GlideAggregate("sys_user_preference");

    if(!gr.isValid())
        return {};
    
    gr.addAggregate("COUNT");
    gr.addEncodedQuery("nameINservicenow_studio.scope.based.tab.grouping.enabled");
    gr.setWorkflow(false);
    gr.groupBy("name");
    gr.groupBy("value");
    gr.query();

    var results = {};

    while(gr.next()) {
        var name = gr.name.toString();
        var value = gr.value.toString();
        var count = parseInt(gr.getAggregate("COUNT"));

        if(results[name] == undefined)
            results[name] = {};

        if(results[name][value] == undefined)
            results[name][value] = 0;

        results[name][value] += count;
    }

    return results;
};

var getBookmarks = function() {
    var gr = new GlideAggregate("sn_udc_collection_item");

    if(!gr.isValid())
        return {};

    gr.addAggregate("COUNT");
    gr.setWorkflow(false);
    gr.groupBy("file_table");
    gr.groupBy("user");
    gr.query();

    var results = {};

    while(gr.next()) {
        var fileType = gr.file_table.toString();
        var count = parseInt(gr.getAggregate("COUNT"));

        if(results[fileType] == undefined)
            results[fileType] = { u: 0, c: 0 };

        results[fileType].u++;
        results[fileType].c += count;
    }

    return results;
};

var getDeveloperHistory = function() {
    var gr = new GlideAggregate("sn_udc_developer_history");

    if(!gr.isValid())
        return {};

    gr.addAggregate("COUNT");
    gr.addEncodedQuery("context=servicenow_studio^last_accessed>javascript:gs.beginningOfLast12Months()");
    gr.setWorkflow(false);
    gr.groupBy("file_table");
    gr.groupBy("user");
    gr.addTrend("last_accessed", "MONTH");
    gr.query();

    var results = {};

    while(gr.next()) {
        var monthYear = gr.getValue('timeref');
        var fileType = gr.file_table.toString();
        var count = parseInt(gr.getAggregate("COUNT"));

        if(results[monthYear] == undefined)
            results[monthYear] = {};

        if(results[monthYear][fileType] == undefined)
            results[monthYear][fileType] = { u: 0, c: 0 };

        results[monthYear][fileType].u++;
        results[monthYear][fileType].c += count;
    }

    return results;
};

(function(){

    setSessionLanguage();

    var results = {
        installationDetails: getInstallationDetails(),
        applicationUsage: getApplicationUsage(),
        systemPropertySettings: getSystemPropertySettings(),
        userRoleCounts: getStudioUserCounts(),
        pipelineStats: getPipelineStats(),
        appCounts: getAppCounts(),
        userPreferences: getUserPreferences(),
        bookmarks: getBookmarks(),
        fileHistory: getDeveloperHistory()
    };

    gs.print(JSON.stringify(results));

})();