
(function(){

    var getAppCustomizations = function() {
        var customizations = {};
        
        (function(){
            var gr = new GlideRecord("sys_app_customization");
            gr.setWorkflow(false);
            gr.query();

            while(gr.next()) {
                var customization = {
                    app: {
                        nm: gr.vendor_app.getDisplayValue(),
                        id: gr.vendor_app.toString(),
                        scope: gr.vendor_app.scope.toString(),
                        version: gr.getValue("vendor_app_version")
                    },
                    createdOn: new GlideDateTime(gr.getValue("sys_created_on")).getDate().getValue(),
                    version: gr.getValue("version"),
                    files: {},
                };

                customizations[gr.getUniqueValue()] = customization;
            }

        })();

        var scopeIds = [];
        var updateNames = [];

        for(var id in customizations) {
            scopeIds.push(customizations[id].app.id);
        }

        (function(){
            var gr = new GlideRecord("sys_claim");
            gr.setWorkflow(false);
            gr.addQuery("claim_owner_scope", "IN", scopeIds.join(","));
            gr.query();

            while(gr.next()) {
                updateNames.push(gr.getValue("metadata_update_name"));
            }
        })();

        (function(){
            var gr = new GlideAggregate("sys_metadata");
            gr.setWorkflow(false);
            gr.addQuery("sys_scope", "IN", scopeIds.join(","));
            gr.addQuery("sys_update_name", "IN", updateNames.join(","));
            gr.groupBy("sys_scope");
            gr.groupBy("sys_class_name");
            gr.addAggregate("COUNT");
            gr.query();

            while(gr.next()) {
                var scopeId = gr.sys_scope.toString();
                var className = gr.sys_class_name.toString();
                var count = parseInt(gr.getAggregate("COUNT"));

                for(var id in customizations) {
                    if(customizations[id].app.id == scopeId) {
                        customizations[id].files[className] = count;
                        break;
                    }
                }
            }

        })();

        return customizations;
    };

    (function() {
        try {
            gs.getSession().setLanguage("en");
        } catch(e) { }
    })();

    var results = {
        customizations: getAppCustomizations()
    };

    gs.print(JSON.stringify(results));

})();
