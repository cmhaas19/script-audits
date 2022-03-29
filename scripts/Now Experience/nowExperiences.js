
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getCurrentLanguage = function() {
	var language = "N/A";
	try {
		language = gs.getSession().getLanguage();
	} catch(e) {}

	return language;
};

var getTemplateGeneratedExperiences = function() {
    var data = {};

    var gr = new GlideRecord("sys_app_template_output_var_instance");

    if(!gr.isValid())
        return data;

    gr.setWorkflow(false);
    gr.addEncodedQuery("template_instance.template=f9daf82749102010374d10b6c97ac9dc^ORtemplate_instance.template=9ca2a579199020106fe59acb96511885^name=sys_ux_page_sys_id");
    gr.query();

    while(gr.next()) {
        var uxPageRegistryId = gr.getValue("value");

        if(uxPageRegistryId && uxPageRegistryId.length)
            data[uxPageRegistryId] = true;
    }

    return data;

};

var getExperiences = function() {
    var data = {};
    var appConfigIds = [];
    var templateGeneratedIds = getTemplateGeneratedExperiences();

    (function(d){
        var gr = new GlideRecord("sys_ux_page_registry");
        
        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.setLimit(45);
        gr.addQuery('sys_scope.scope', 'NOT LIKE', 'sn_%');
        gr.addQuery('sys_id', '!=', '2cbe185e0fb12010d620d55566767e33');
        gr.addQuery('sys_id', '!=', '096bd1fb0fc32010d620d55566767e85');
        gr.addQuery('sys_id', '!=', 'ad03e8565392101057f1ddeeff7b125a');
        gr.query();

        while(gr.next()){     
            var uxApplicationId = gr.getUniqueValue();       

            var uxApplication = {
                title: gr.getValue("title"),
                url: gr.getValue("path"),
                active: (gr.getValue("active") == "1"),
                scope: gr.sys_scope.scope.toString(),
                templateGenerated: (templateGeneratedIds[uxApplicationId] === true),
                createdOn: gr.getValue("sys_created_on"),
                updatedOn: gr.getValue("sys_updated_on")
            };

            if(!gr.admin_panel.nil()) {
                var adminPanel = gr.admin_panel.getRefRecord();

                uxApplication.adminPanel = {
                    id: gr.getValue("admin_panel"),
                    table: gr.getValue("admin_panel_table"),
                    name: adminPanel.getValue("name"),
                    landingPath: adminPanel.getValue("landing_path"),
                    appRoutes: []
                };

                appConfigIds.push(uxApplication.adminPanel.id);
            }

            if(!gr.root_macroponent.nil()) {
                uxApplication.appShell = {
                    id: gr.getValue("root_macroponent"),
                    name: gr.root_macroponent.getDisplayValue(),
                    category: gr.root_macroponent.category.getDisplayValue(),
                    extendsId: gr.root_macroponent["extends"].toString(),
                    extendsName: gr.root_macroponent["extends"].getDisplayValue()
                };
            }

            d[uxApplicationId] = uxApplication;
        }

    })(data);

    (function(d){
        var gr = new GlideRecord("sys_ux_app_route");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.addEncodedQuery("parent_macroponent_composition_element_id=NULL^app_configIN" + appConfigIds.join(","));
        gr.query();

        while(gr.next()){
            var adminPanel = null;
            var adminPanelId = gr.getValue("app_config");

            for(var id in d) {
                if(d[id].adminPanel.id == adminPanelId){
                    adminPanel = d[id].adminPanel;
                    break;
                }
            }

            if(adminPanel != null) {
                adminPanel.appRoutes.push(gr.getValue("name"));
            }
        }

    })(data);    

    return data;
};

(function() {

    var results = {
        companyCode: getCompanyCode(),
        currentLanguage: getCurrentLanguage(),
        experiences: getExperiences()
    };

    gs.print(JSON.stringify(results));

})();