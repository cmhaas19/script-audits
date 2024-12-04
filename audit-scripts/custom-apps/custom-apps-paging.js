(function() {
    var RANGES = {
        r1: { start: 0, end: 320 },
        r2: { start: 321, end: 640 },
        r3: { start: 641, end: 960 },
        r4: { start: 961, end: 1280 },
        r5: { start: 1281, end: 1600 },
        r6: { start: 1601, end: 1920 },
        r7: { start: 1921, end: 2240 }
    };
    var CURRENT_RANGE = RANGES.r1; // Update this in separate read audits

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
        gr.chooseWindow(CURRENT_RANGE.start, CURRENT_RANGE.end);
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

            if(!gr.ide_created.nil()) {
                apps[className][appId].i = gr.getValue("ide_created");
            }
        }

    })(result.apps);

    gs.print(JSON.stringify(result));

})();

