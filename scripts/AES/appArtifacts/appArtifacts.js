
var CONSTANTS = {
    AES_SCOPE: "sn_app_eng_studio"
};

var isAppEngineStudioInstalled = function() {    
    var gr = new GlideRecord("sys_store_app");
    gr.setWorkflow(false);
    gr.addQuery("scope=" + CONSTANTS.AES_SCOPE);
    gr.query();

    return gr.next();
};

var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getAESAppArtifacts = function() {

    //
    // Return the sysIDs of all AES generated Apps
    //
    var aesApps = (function(){
        var apps = {};

        var gr = new GlideRecord("sys_app_template_output_var_instance");

        if(!gr.isValid())
            return apps;

        gr.setWorkflow(false);
        gr.addEncodedQuery("name=app_sys_id^template_instance.app_template=true^template_instance.state=complete");
        gr.query();

        var apps = {};

        while(gr.next()){
            var appSysId = gr.getValue("value");

            if(appSysId && appSysId.indexOf("step") == -1)
                apps[appSysId] = 1;
        }

        return apps;
    })();

    if(Object.keys(aesApps).length == 0)
        return;

    //
    // Now get all the scopes for the AES generated apps
    //
    var scopes = (function(){
        var gr = new GlideRecord("sys_app");
        gr.setWorkflow(false);
        gr.addEncodedQuery("scopeSTARTSWITHx_" + getCompanyCode() + "^active=true^sys_idIN" + Object.keys(aesApps));
        gr.query();

        var scopedApps = {};

        while(gr.next()) {
            scopedApps[gr.scope.toString()] = 1;
        }

        return scopedApps;
    })();

    if(Object.keys(scopes).length == 0)
        return;

    //
    // Using the scopes, get the artifacts
    //
    return (function(){
        var gr = new GlideAggregate("sys_metadata");
        gr.setWorkflow(false);
        gr.addAggregate("COUNT");
        gr.addEncodedQuery("sys_scope.scopeIN" + Object.keys(scopes).join(","));
        gr.groupBy("sys_scope");
        gr.groupBy("sys_class_name");
        gr.query();

        var artifacts = {};

        while(gr.next()){
            var count = parseInt(gr.getAggregate("COUNT")),
                className = gr.sys_class_name.toString();

            if(artifacts[className] == undefined)
                artifacts[className] = { totalCount: 0, apps: 0 };

            artifacts[className].totalCount += count;
            artifacts[className].apps += 1;
        }

        return artifacts;
    })();
};

(function(){

    var results = {
        installed: isAppEngineStudioInstalled(),
        companyCode: getCompanyCode(),
        appArtifacts: getAESAppArtifacts()
    };

    gs.print(JSON.stringify(results));

})();