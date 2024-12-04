(function() {

    var result = {
        code: gs.getProperty('glide.appcreator.company.code'),
        counts: { total: 0, store: 0, custom: 0},
        apps: {}
    };

    //
    // Get counts
    //
    (function(counts){
        var gr = new GlideAggregate('sys_scope');
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_class_name=sys_store_app^scopeSTARTSWITHx_^ORscope=global^ORscopeISEMPTY^NQsys_class_name=sys_app");
        gr.addAggregate('COUNT');
        gr.query();

        counts.total = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

        gr = new GlideAggregate('sys_scope');
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_class_name=sys_store_app^scopeSTARTSWITHx_^ORscope=global^ORscopeISEMPTY");
        gr.addAggregate('COUNT');
        gr.query();

        counts.store = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

        gr = new GlideAggregate('sys_scope');
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_class_name=sys_app");
        gr.addAggregate('COUNT');
        gr.query();

        counts.custom = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

    })(result.counts);

    //
    // Now return the apps
    //
    (function(apps){
        var gr = new GlideRecord('sys_scope');
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_class_name=sys_store_app^scopeSTARTSWITHx_^ORscope=global^ORscopeISEMPTY^NQsys_class_name=sys_app");
        gr.orderBy("sys_id");
        gr.query();

        while(gr.next()) {
            var className = gr.getValue("sys_class_name");
            var appId = gr.getUniqueValue();
    
            if(apps[className] == undefined)
                apps[className] = {};
    
            apps[className][appId] = { 
                s: gr.scope.toString(), 
                c: new GlideDateTime(gr.getValue("sys_created_on")).getDate().getByFormat("YYYY-MM")
            };

            var ide = null;

            if(!gr.ide_created.nil()) {
                ide = gr.getValue("ide_created");
            }

            if(ide == null && !gr.package_json.nil()) {
                ide = "IDE";
            }

            if(ide != null) {
                apps[className][appId].i = ide;
            }

        }

    })(result.apps);

    gs.print(JSON.stringify(result));

})();

