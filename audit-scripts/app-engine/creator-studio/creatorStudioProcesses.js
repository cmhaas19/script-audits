
var getCreatorStudioProcesses = function(range) {
    var scopes = {};
    var processes = {};
    var tids = {};

    //
    // Get the request apps and associated scopes
    //
    (function(){
        var gr = new GlideRecord("sn_creatorstudio_request_app_config");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.orderBy("sys_scope");
        gr.chooseWindow(range.start, range.end);
        gr.query();

        while(gr.next()) {
            scopes[gr.sys_scope.scope.toString()] = true;
        }

    })();

    if(Object.keys(scopes).length == 0)
        return [];

    //
    // Get the processes definitions 
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
                type: gr.trigger_type.getDisplayValue()
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
                    var label = gr.variable.getDisplayValue(),
                        value = gr.value.toString(),
                        scrubbedValue = "";

                    if(label == "Table")
                        continue;

                    if(label == "Condition") {
                        var condition = value.split("^");
                        var parts = [];

                        condition.forEach(function(part) {
                            if(!part.startsWith("request_type=")){
                                parts.push(part);
                            }
                        });

                        if(parts.length > 0) {
                            scrubbedValue = parts.join("^");
                        }

                    } else {
                        scrubbedValue = value;
                    }

                    if(scrubbedValue.length > 0) {
                        if(processes[pid].trigger.v == undefined) {
                            processes[pid].trigger.v = {};
                        }
                        processes[pid].trigger.v[label] = scrubbedValue;
                    }                        
                }
            }		
        }

    })();

    //
    // Now get the activities
    //
    (function(){
        var gr = new GlideRecord("sys_pd_activity");
        gr.addEncodedQuery("process_definitionIN" + Object.keys(processes).join());
        gr.setWorkflow(false);
        gr.addActiveQuery();
        gr.orderBy("order");
        gr.query();

        while(gr.next()) {
            var pid = gr.process_definition.toString();
            var activityName = gr.activity_definition.getDisplayValue();
            var process = processes[pid];

            if(process != undefined) {
                if(process.activities == undefined)
                    process.activities = [];                    

                var activity = {
                    nm: activityName,
                    o: gr.getValue("order")
                };

                if(gr.condition_to_run.toString().length > 0)
                    activity.c = gr.condition_to_run.toString();

                process.activities.push(activity);
            }
        }

    })();


    //
    // Transform the result to reduce the payload
    //
    var results = [];

    for(var pid in processes) {
        var process = processes[pid];

        if(process.trigger && process.trigger.id) {
            delete process.trigger.id;
        }
        
        results.push(process);
    }

    return results;

};

var setSessionLanguage = function() {
    try {
        gs.getSession().setLanguage("en");
    } catch(e) { }
};

(function() {

    setSessionLanguage();

    var ranges = {
        r1: { start: 0, end: 99 },
        r2: { start: 100, end: 199 },
        r3: { start: 200, end: 299 },
        r4: { start: 300, end: 399 },
    };

    var apps = getCreatorStudioProcesses(ranges.r1);

    gs.print(JSON.stringify(apps));

})();