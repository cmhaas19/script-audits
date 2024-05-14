
/*
    processes: [{
        pid: "123",
        scope: "",
        type: "",
        trigger: {
            id: "123",
            type: "",
            variables: {
                "var1": "value1",
                "var2": "value2"
            },
            activities: [{
            }]
    }]
*/

var getCreatorStudioProcesses = function(range) {
    var scopes = {};
    var processes = {};

    //
    // Get the request apps and associated scopes
    //
    (function(){
        var gr = new GlideRecord("sn_creatorstudio_request_app_config");
        gr.setWorkflow(false);
        gr.orderBy("sys_scope");
        gr.chooseWindow(range.start, range.end);
        gr.query();

        while(gr.next()) {
            scopes[gr.sys_scope.scope.toString()] = true;
        }

    })();

    //
    // Get the automation details
    //
    (function(){
        var tids = {};

        //
        // Get the processes definitions 
        // TODO: could probably use some joinQueries so we don't have to cache the scopes and use an IN query
        //
        (function(){
            var gr = new GlideRecord("sys_pd_process_definition");
            gr.setWorkflow(false);
            gr.addQuery("sys_scope.scope", "IN", Object.keys(scopes).join());
            gr.query();

            while(gr.next()) {
                var pid = gr.getUniqueValue();

                processes[pid] = {
                    scope: gr.sys_scope.scope.toString(),
                    type: gr.process_type.getDisplayValue()
                };
            }

        })();

        //
        // With the ids, get the trigger details
        //
        (function(){
            var gr = new GlideRecord("sys_pd_trigger_instance");
            gr.addEncodedQuery("process_definitionIN" + Object.keys(processes).join());
            gr.setWorkflow(false);
            gr.query();
    
            while(gr.next()) {
                var pid = gr.process_definition.toString();
                var tid = gr.getUniqueValue();

                tids[tid] = true;

                processes[pid].trigger = {
                    id: tid,
                    type: gr.trigger_type.getDisplayValue(),
                    variables: {}
                };			
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

                for(var pid in processes) {
                    if(processes[pid].trigger.id == tid) {
                        processes[pid].trigger.variables[gr.variable.getDisplayValue()] = gr.value.toString();
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

    return processes;

};



(function() {

    var ranges = {
        r1: { start: 0, end: 549 },
        r2: { start: 550, end: 1099 },
        r3: { start: 1100, end: 1649 },
        r4: { start: 1650, end: 2199 },
    };

    var apps = getCreatorStudioProcesses(ranges.r1);

    gs.print(JSON.stringify(apps));

})();