
var getTemplateGeneratedApps = function() {    
    var apps = {};
    var gr = new GlideRecord("sys_app_template_output_var_instance");

    if(!gr.isValid())
        return apps;

    gr.setLimit(420);
    gr.setWorkflow(false);
    gr.addEncodedQuery("name=app_sys_id^template_instance.app_template=true^template_instance.state=complete^valueNOT LIKEstep");
    gr.query();

    while(gr.next()){
        apps[gr.getValue("value")] = gr.template_instance.template.toString();            
    }

    return apps;
};

(function() {

    var results = {
        aesApps: getTemplateGeneratedApps()
    };

    gs.print(JSON.stringify(results));

})();