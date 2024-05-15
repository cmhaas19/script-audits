
var getCreatorStudioForms = function() {    
    var scopes = {};
    var results = {
        templates: {},
        fieldTypes: {}
    };

    ///
    // Get the request apps and associated scopes
    //
    (function(){
        var gr = new GlideRecord("sn_creatorstudio_request_app_config");

        if(!gr.isValid())
            return;
        
        gr.setWorkflow(false);
        gr.orderBy("sys_scope");
        gr.query();

        while(gr.next()) {
            scopes[gr.sys_scope.scope.toString()] = true;
        }

    })();

    if(Object.keys(scopes).length == 0)
        return;

    //
    // Get forms grouped by template used
    //
    (function(){
        var gr = new GlideAggregate("sc_cat_item_producer");
        gr.setWorkflow(false);
        gr.addEncodedQuery("published_refISEMPTY^sys_scope.scopeIN" + Object.keys(scopes).join());
        gr.groupBy("sc_template");
        gr.addAggregate("COUNT");
        gr.query();

        while(gr.next()) {
            var template = (gr.sc_template.nil() ? "(empty)" : gr.sc_template.getDisplayValue());
            
            results.templates[template] = parseInt(gr.getAggregate("COUNT"));
        }

    })();

    //
    // Get form field types used
    //
    (function(){
        var gr = new GlideAggregate("item_option_new");
        gr.setWorkflow(false);
        gr.addEncodedQuery("cat_item.sys_class_name=sc_cat_item_producer^cat_item.published_refISEMPTY^sys_scope.scopeIN" + Object.keys(scopes).join());
        gr.groupBy("cat_item");
        gr.groupBy("type");
        gr.addAggregate("COUNT");
        gr.query();

        while(gr.next()){
            var questionClass = gr.type.getDisplayValue(),
                count = parseInt(gr.getAggregate("COUNT"));

            if(results.fieldTypes[questionClass] == undefined)
                results.fieldTypes[questionClass] = { forms: 0, total: 0 };

            results.fieldTypes[questionClass].forms++;
            results.fieldTypes[questionClass].total += count;
        }

    })();
    
    return results;
};

var setSessionLanguage = function() {
    try {
        gs.getSession().setLanguage("en");
    } catch(e) { }
};

(function() {

    setSessionLanguage();

    var results = getCreatorStudioForms();

    gs.print(JSON.stringify(results));

})();