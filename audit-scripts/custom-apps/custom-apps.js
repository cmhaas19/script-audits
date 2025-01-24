(function() {

    var result = {
        code: gs.getProperty('glide.appcreator.company.code'),
        counts: { total: 0, store: 0, custom: 0},
        apps: {},
    };

    //
    // Get counts
    //
    (function(){
        var gr = new GlideAggregate('sys_scope');
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_class_name=sys_store_app^scopeSTARTSWITHx_^ORscope=global^ORscopeISEMPTY^NQsys_class_name=sys_app");
        gr.addAggregate('COUNT');
        gr.query();

        result.counts.total = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

        gr = new GlideAggregate('sys_scope');
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_class_name=sys_store_app^scopeSTARTSWITHx_^ORscope=global^ORscopeISEMPTY");
        gr.addAggregate('COUNT');
        gr.query();

        result.counts.store = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

        gr = new GlideAggregate('sys_scope');
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_class_name=sys_app");
        gr.addAggregate('COUNT');
        gr.query();

        result.counts.custom = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

    })();

    //
    // Now get the apps
    //
    (function(){
        var gr = new GlideRecord('sys_scope');
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_class_name=sys_store_app^scopeSTARTSWITHx_^ORscope=global^ORscopeISEMPTY^NQsys_class_name=sys_app");
        gr.orderBy("sys_id");
        gr.query();

        while(gr.next()) {
            var className = gr.getValue("sys_class_name");
            var appId = gr.getUniqueValue();
    
            if(result.apps[className] == undefined)
                result.apps[className] = {};
    
            result.apps[className][appId] = { 
                s: gr.scope.toString(), 
                c: gr.sys_created_on.nil() ? null : new GlideDateTime(gr.getValue("sys_created_on")).getDate().getByFormat("YYYY-MM-dd")
            };

            var ide = null;

            if(gr.isValidField("ide_created") && !gr.ide_created.nil()) {
                ide = gr.getValue("ide_created");
            }

            if(ide == null && gr.isValidField("package_json") && !gr.package_json.nil()) {
                ide = "IDE";
            }

            if(ide != null) {
                result.apps[className][appId].i = ide;
            }
        }

    })();

    //
    // Get the last updated date based on metadata contents
    // 
    (function(){

        var gr = new GlideAggregate('sys_metadata');
        gr.setWorkflow(false);
        gr.addAggregate('MAX', 'sys_updated_on'); 
        gr.addAggregate('COUNT'); 
        gr.groupBy("sys_scope");

        var joinQuery = gr.addJoinQuery('sys_scope', 'sys_scope', 'sys_id');
        var qc1 = joinQuery.addCondition('sys_class_name', 'IN', 'sys_store_app,sys_app');
        var qc2 = qc1.addCondition('scope', 'STARTSWITH', 'x_');
        qc2.addOrCondition('scope', 'global'); 

        gr.query();

        while(gr.next()) {
            var appId = gr.getValue("sys_scope");
            var artifactCount = parseInt(gr.getAggregate("COUNT"));
            var updated = new GlideDateTime(gr.getAggregate("MAX", "sys_updated_on")).getDate().getByFormat("YYYY-MM-dd");

            for(var className in result.apps) {
                for(var id in result.apps[className]) {
                    if(id == appId) {
                        result.apps[className][id].u = updated;
                        result.apps[className][id].cnt = artifactCount;
                    }
                }
            }
        }

    })();

    gs.print(JSON.stringify(result));

})();