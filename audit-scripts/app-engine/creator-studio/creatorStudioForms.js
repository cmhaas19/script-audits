
var getProcessData = function(){

}

var getCreatorStudioApps = function(range) {
    var apps = {};
    var scopes = {};

    //
    // Get the request apps and associated scopes
    //
    (function(){
        var gr = new GlideRecord("sn_creatorstudio_request_app_config");
        gr.setWorkflow(false);
        gr.chooseWindow(range.start, range.end);
        gr.query();

        while(gr.next()) {
            var scope = gr.sys_scope.scope.toString();

            apps[scope] = {
                table: gr.getValue("request_table"),
                created: new GlideDateTime(gr.getValue("sys_created_on")).getDate().getValue(),
                color: gr.getValue("color"),
                icon: gr.getValue("icon")
            };
        }

    })();

    //
    // Count the # of record producers (forms) in each app scope
    //
    (function(){
        var gr = new GlideAggregate("sc_cat_item_producer");
        gr.setWorkflow(false);
        gr.addEncodedQuery("published_refISEMPTY^sys_scope.scopeIN" + Object.keys(apps).join());
        gr.groupBy("sys_scope");
        gr.groupBy("active");
        gr.addAggregate("COUNT");
        gr.query();

        while(gr.next()) {
            var scope = gr.sys_scope.scope.toString();
            var active = (gr.active.toString() == "true");
            var app = apps[scope];
            var count = parseInt(gr.getAggregate("COUNT"));

            if(app.forms == undefined)
                app.forms = {};

            if(active) {
                app.forms.active = count;
            } else {
                app.forms.inactive = count;
            }
        }

    })();

    //
    // Get the automation details
    //
    (function(){
        var pids = {};
        var tids = {};

        //
        // Get the processes & ids
        //
        (function(){
            var gr = new GlideRecord("sys_pd_process_definition");
            gr.setWorkflow(false);
            gr.addQuery("sys_scope.scope", "IN", Object.keys(apps));
            gr.query();

            while(gr.next()) {
                var scope = gr.sys_scope.scope.toString();
                var pid = gr.getUniqueValue();
                var app = apps[scope];

                pids[pid] = true;

                if(app.processes == undefined)
                    app.processes = {};

                app.processes[pid] = {
                    type: gr.process_type.getDisplayValue()
                };
            }

        })();

        //
        // With the ids, get the trigger details
        //
        (function(){
            var gr = new GlideRecord("sys_pd_trigger_instance");
            gr.addEncodedQuery("process_definitionIN" + Object.keys(pids).join());
            gr.setWorkflow(false);
            gr.query();
    
            while(gr.next()) {
                var pid = gr.process_definition.toString();
                var tid = gr.getUniqueValue();

                tids[tid] = true;

                for(var scope in apps) {
                    if(apps[scope].processes != undefined && apps[scope].processes[pid] != undefined) {
                        apps[scope].processes[pid].trigger = { 
                            id: tid,
                            type: gr.trigger_type.getDisplayValue(),
                            variables: {}
                        };
                    }
                }			
            }
        })();

        //
        // With the trigger details, get the variables
        //
        (function(){
            var gr = new GlideRecord("sys_variable_value");
            gr.addEncodedQuery("document=sys_pd_trigger_instance^document_keyIN" + Object.keys(tids).join());
            gr.setWorkflow(false);
            gr.query();
    
            while(gr.next()) {
                var tid = gr.document_key.toString();

                for(var scope in apps) {
                    if(apps[scope].processes != undefined) {
                        for(var pid in apps[scope].processes) {
                            var process = apps[scope].processes[pid];

                            if(process.trigger != undefined && process.trigger.id == tid) {
                                process.trigger.variables[gr.variable.getDisplayValue()] = gr.value.toString();
                            }
                        }
                    }
                }			
            }
        })();

        //
        // Now get the activities (in order)
        //


        //
        // Transform the result to reduce the payload
        //
        

    })();

    return apps;
    

    // Get request app configs
    // For each request app,
    // Count the # of forms
    //    Count the # of records created for each form
    //    Count the # of field types
    // Count the # of automations
    //    Count the # of automation executions for each automation
    // Count the # of users assigned the role

};



(function() {

    var ranges = {
        r1: { start: 0, end: 549 },
        r2: { start: 550, end: 1099 },
        r3: { start: 1100, end: 1649 },
        r4: { start: 1650, end: 2199 },
    };

    var apps = getCreatorStudioApps(ranges.r1);

    gs.print(JSON.stringify(apps));

})();