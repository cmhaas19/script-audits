
var CONSTANTS = {
    GUIDED_SETUP_ID: "411b157f0f602010310be3d1df767e7b",
    AES_USER_ROLE: "97f4a0c20f123300e54f3c71df767ea2",
    DELEGATED_DEV_ROLE: "a8772c23673302006cc275f557415ad4",
    AES_SCOPE: "sn_app_eng_studio",
    AES_PLUGIN_ID: "com.snc.app-engine-studio"
};

var getInstallationDetails = function() {    
    var gr = new GlideRecord("sys_store_app");
    gr.setWorkflow(false);
    gr.addQuery("scope=" + CONSTANTS.AES_SCOPE);
    gr.query();

    var installationDetails = {
        installed: gr.next()
    };

    if(installationDetails.installed) {
        installationDetails.installedOn = gr.getValue("install_date");
    }

    return installationDetails;
};

var getAESCreatedApps = function() {
    var gr = new GlideRecord("sys_app_template_output_var_instance");
    gr.setWorkflow(false);
    gr.addEncodedQuery("name=app_sys_id^template_instance.app_template=true^template_instance.state=complete");
    gr.query();

    var apps = {};

    while(gr.next()){
        var templateId = gr.getValue("template_instance"),
            templateName = gr.template_instance.getDisplayValue(),
            appSysId = gr.getValue("value");

        if(appSysId && appSysId.indexOf("step") == -1)
            apps[appSysId] = { templateId: templateId, templateName: templateName };
    }

    return apps;
};

var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getApps = function(table, installedField) {
    var gr = new GlideRecord(table);
    gr.setWorkflow(false);
    gr.addEncodedQuery("scopeSTARTSWITHx_" + getCompanyCode() + "^active=true");
    gr.query();

    var apps = {};

    while(gr.next()) {
        apps[gr.getUniqueValue()] = { 
            name: gr.getValue("name"), 
            scope: gr.scope.toString()
        };
        apps[gr.getUniqueValue()][installedField] = gr.getValue(installedField);
    }

    return apps;
};

var getCustomStoreApps = function() {
    return getApps("sys_store_app", "install_date");
};

var getCustomApps = function() {
    var scopedApps = getApps("sys_app", "sys_created_on"),
        aesApps = getAESCreatedApps();

    for(var app in aesApps) {
        var scopedApp = scopedApps[app],
            aesApp = aesApps[app];

        if(scopedApp){
            scopedApp.templateId = aesApp.templateId;
            scopedApp.templateName = aesApp.templateName;
            scopedApp.isAESApp = true;
        }
    }

    return scopedApps;
};

(function(){

    var results = {
        installationDetails: getInstallationDetails()
    };

    if(results.installationDetails.installed) {
        results.companyCode = getCompanyCode();
        results.customStoreApps = getCustomStoreApps();
        results.customApps = getCustomApps();
    
        gs.print(JSON.stringify(results));
    }

})();