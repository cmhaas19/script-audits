

var getScopesWithWorkspacesCreatedFromTemplates = function() {
    var appIds = {};
    var scopes = {};

    (function(d){
        var gr = new GlideRecord("sys_app_template_output_var_instance");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.addEncodedQuery("template_instance.template=f9daf82749102010374d10b6c97ac9dc^ORtemplate_instance.template=9ca2a579199020106fe59acb96511885^name=app_sys_id");
        gr.query();

        while(gr.next()) {
            var id = gr.getValue("value");

            if(id && id.length)
                d[id] = true;
        }
    })(appIds);


    (function(d){
        var gr = new GlideRecord("sys_app");
        gr.setLimit(1400);
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_idIN" + Object.keys(d).join(","));
        gr.query();

        while(gr.next()) {
            var scope = gr.getValue("scope");
            scopes[scope] = true;
        }

    })(appIds);

    return Object.keys(scopes);
};

(function() {

    var results = {
        templateExperiences: getScopesWithWorkspacesCreatedFromTemplates()
    };

    gs.print(JSON.stringify(results));

})();