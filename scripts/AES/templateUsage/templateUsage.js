
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

var getTemplateUsage = function() {
    var templateInstances = {};

    (function(data){
        var gr = new GlideRecord("sys_app_template_instance");
        if(gr.isValid()) {
            gr.setWorkflow(false);
            gr.addEncodedQuery("state=complete^sys_updated_on>=javascript:gs.beginningOfLast30Days()");
            gr.query();

            while(gr.next()){
                data[gr.getUniqueValue()] = {
                    templateName: gr.template.getDisplayValue(),
                    templateId: gr.getValue("template"),
                    isApp: (gr.getValue("app_template") == "1"),
                    createdOn: gr.getValue("sys_created_on"),
                    updatedOn: gr.getValue("sys_updated_on")
                };
            }
        };
    })(templateInstances);

    (function(data){
        var gr = new GlideRecord("sys_app_template_output_var_instance");
        if(gr.isValid()){
            gr.setWorkflow(false);
            gr.addEncodedQuery("template_instance.app_template=true^name=app_sys_id");
            gr.query();

            while(gr.next()){
                var id = gr.getValue("template_instance");

                if(data[id])
                    data[id].appSysId = gr.getValue("value");
            }
        }
        

    })(templateInstances);

    return templateInstances;
};

(function(){

    var results = {
        installed: isAppEngineStudioInstalled(),
        templateUsage: getTemplateUsage()
    };

    gs.print(JSON.stringify(results));

})();