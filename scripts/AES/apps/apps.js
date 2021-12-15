
var CONSTANTS = {
    AES_SCOPE: "sn_app_eng_studio"
};

var getInstallationDetails = function() {    
    var gr = new GlideRecord("sys_store_app");
    gr.setWorkflow(false);
    gr.addQuery("scope=" + CONSTANTS.AES_SCOPE);
    gr.query();

    var installationDetails = {
        installed: false,
        licensed: false,
        licensedPlugin: false,
        licensedApp: false,
        buildName: gs.getProperty("glide.buildname"),
        buildTag: gs.getProperty("glide.buildtag")
    };

    if(gr.next()) {
        installationDetails.installed = true;
        installationDetails.installedOn = gr.getValue("install_date");
    }

    try {
        installationDetails.licensedPlugin = sn_lef.GlideEntitlement.hasLicenseForApp(CONSTANTS.AES_PLUGIN_ID);
    } catch (e) { }
    
    try {
        installationDetails.licensedApp = sn_lef.GlideEntitlement.hasLicenseForApp(CONSTANTS.AES_SCOPE);
    } catch (e) { }

    installationDetails.licensed = (installationDetails.licensedPlugin || installationDetails.licensedApp);

    return installationDetails;
};

var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getCustomStoreApps = function() {
    var gr = new GlideRecord("sys_store_app");
    gr.setWorkflow(false);
    gr.addEncodedQuery("scopeSTARTSWITHx_" + getCompanyCode() + "^active=true");
    gr.query();

    var apps = {};

    while(gr.next()) {
        apps[gr.getUniqueValue()] = { 
            name: gr.getValue("name"), 
            scope: gr.scope.toString(),
            installedOn: gr.getValue("install_date")
        };
    }

    return apps;
};

var getCustomApps = function() {

    //
    // Get all custom scoped apps created by this customer (via the company code)
    //
    var scopedApps = (function(){
        var gr = new GlideRecord("sys_app");
        gr.setWorkflow(false);
        gr.setLimit(5000);
        gr.addEncodedQuery("scopeSTARTSWITHx_" + getCompanyCode() + "^active=true");
        gr.orderByDesc("sys_created_on");
        gr.query();

        var apps = {};

        while(gr.next()) {
            apps[gr.getUniqueValue()] = { 
                name: gr.getValue("name"), 
                scope: gr.scope.toString(),
                logo: gr.getValue("logo"),
                createdOn: gr.getValue("sys_created_on"),
                sourceControl: false
            };
        }

        return apps;
    })();

    //
    // Retrieve the sysIds of all apps created in AES (via template generator)
    //
    var aesApps = (function(){
        var apps = {};
        var gr = new GlideRecord("sys_app_template_output_var_instance");

        if(gr.isValid()) {
            gr.setWorkflow(false);
            gr.addEncodedQuery("name=app_sys_id^template_instance.app_template=true^template_instance.state=complete");
            gr.query();

            while(gr.next()){
                var templateId = gr.template_instance.template.toString(),
                    templateName = gr.template_instance.getDisplayValue(),
                    appSysId = gr.getValue("value");

                if(appSysId && appSysId.indexOf("step") == -1)
                    apps[appSysId] = { templateId: templateId, templateName: templateName };
            }
        }

        return apps;
    })();

    //
    // Compare all custom scoped apps and mark which ones originated in AES
    //
    for(var app in aesApps) {
        var scopedApp = scopedApps[app],
            aesApp = aesApps[app];

        if(scopedApp){
            scopedApp.tId = aesApp.templateId;
            scopedApp.tName = aesApp.templateName;
            scopedApp.aes = true;
        }
    }

    //
    // Get source control status
    //
    (function(){
        var gr = new GlideRecord("sys_repo_config");
        gr.setWorkflow(false);
        gr.addJoinQuery("sys_app", "sys_app", "sys_id");
        gr.query();

        while(gr.next()){
            var id = gr.getValue("sys_app");
            if(scopedApps[id]) {
                scopedApps[id].sourceControl = true;
            }
        }
    })();

    return scopedApps;
};

var getCurrentLanguage = function() {
	var language = "N/A";
	try {
		language = gs.getSession().getLanguage();
	} catch(e) {}

	return language;
};

(function() {

    var results = {
        companyCode: getCompanyCode(),
        currentLanguage: getCurrentLanguage(),
        installationDetails: getInstallationDetails(),
        customStoreApps: getCustomStoreApps(),
        customApps: getCustomApps()
    };

    gs.print(JSON.stringify(results));

})();