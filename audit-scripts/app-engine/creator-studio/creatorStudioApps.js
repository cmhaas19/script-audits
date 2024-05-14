
var getCreatorStudioApps = function(range) {
    var apps = {};

    (function(){
        var gr = new GlideRecord("sn_creatorstudio_request_app_config");

        if(!gr.isValid())
            return apps;

        gr.chooseWindow(range.start, range.end);
        gr.setWorkflow(false);
        gr.orderBy("sys_scope");
        gr.query();

        while(gr.next()) {
            var scope = gr.sys_scope.scope.toString();

            apps[scope] = {
                id: gr.getUniqueValue(),
                tb: gr.getValue("request_table"),
                cr: new GlideDateTime(gr.getValue("sys_created_on")).getDate().getValue(),
                cl: gr.getValue("color"),
                i: gr.getValue("icon"),
                f: 0,
                p: 0,
                l: 0,
                r: 0,
                ff: 0
            };
        }

    })();

    if(Object.keys(apps).length == 0)
        return apps;

    (function(){
        var gr = new GlideAggregate("sc_cat_item_producer");
        gr.setWorkflow(false);
        gr.addEncodedQuery("published_refISEMPTY^sys_scope.scopeIN" + Object.keys(apps).join());
        gr.groupBy("sys_scope");
        gr.addAggregate("COUNT");
        gr.query();

        while(gr.next()) {
            var scope = gr.sys_scope.scope.toString();
            apps[scope].f = parseInt(gr.getAggregate("COUNT"));
        }

    })();

    (function(){
        var gr = new GlideAggregate("sys_pd_process_definition");
        gr.setWorkflow(false);
        gr.addQuery("sys_scope.scope", "IN", Object.keys(apps).join());
        gr.groupBy("sys_scope");
        gr.addAggregate("COUNT");
        gr.query();

        while(gr.next()) {
            var scope = gr.sys_scope.scope.toString();
            apps[scope].p = parseInt(gr.getAggregate("COUNT"));
        }

    })();

    (function(){
        var gr = new GlideAggregate("sn_creatorstudio_task");

        if(gr.isValid()) {
            gr.setWorkflow(false);
            gr.groupBy("sys_class_name");
            gr.addAggregate("COUNT");
            gr.query();

            while(gr.next()) {
                var tableName = gr.sys_class_name.toString();

                for(var scope in apps) {
                    if(apps[scope].tb == tableName) {
                        apps[scope].r += parseInt(gr.getAggregate("COUNT"));
                    }
                }
            }
        }

    })();

    (function(){
        var gr = new GlideAggregate("sys_user_has_role");
        gr.setWorkflow(false);
        gr.addEncodedQuery("role.sys_scope.scopeIN" + Object.keys(apps).join());
        gr.groupBy("role");
        gr.addAggregate("COUNT");
        gr.query();

        while(gr.next()) {
            var scope = gr.role.sys_scope.scope.toString();
            apps[scope].ff += parseInt(gr.getAggregate("COUNT"));
        }

    })();

    (function(){
        var gr = new GlideAggregate("sys_ux_list");
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_scope.scopeIN" + Object.keys(apps).join());
        gr.groupBy("sys_scope");
        gr.addAggregate("COUNT");
        gr.query();

        while(gr.next()) {
            var scope = gr.sys_scope.scope.toString();
            apps[scope].l = parseInt(gr.getAggregate("COUNT"));
        }

    })();


    return apps;
};



(function() {

    var ranges = {
        r1: { start: 0, end: 149 },
        r2: { start: 150, end: 299 },
        r3: { start: 300, end: 449 },
        r4: { start: 450, end: 599 },
    };

    var apps = getCreatorStudioApps(ranges.r1);

    gs.print(JSON.stringify(apps));

})();