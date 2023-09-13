

var getTotalProcesses = function() {
    var gr = new GlideAggregate("sys_pd_process_definition");
    gr.setWorkflow(false);
    gr.addActiveQuery();
    gr.addAggregate("COUNT");
    gr.query();

    return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
};

var getProcesses = function(range) {

    var processes = (function(){
        var gr = new GlideRecord("sys_pd_process_definition");
        gr.setWorkflow(false);
        gr.addActiveQuery();
        gr.orderByDesc("sys_id");
		gr.chooseWindow(range.start, range.end);
        gr.query();

        var processes = {};

        while(gr.next()) {
            var id = gr.getUniqueValue();

            processes[id] = {
                nm: gr.getValue("label"),
                cd: new GlideDateTime(gr.getValue("sys_created_on")).getDate().getValue()
            };            
        }

        return processes;

    })();

    //
    // Get trigger details
    //
    (function(){
		var gr = new GlideRecord("sys_pd_trigger_instance");
		gr.setWorkflow(false);
        gr.query();

		while(gr.next()) {
            var pid = gr.process_definition.toString();
            var process = processes[pid];

            if(process != undefined) {
                process.trigger = gr.trigger_type.getDisplayValue();
            }			
		}
	})();

    //
    // Populate activities
    //
    (function(){
        var gr = new GlideAggregate("sys_pd_activity");
        gr.groupBy("process_definition");
        gr.groupBy("activity_definition");
        gr.addAggregate("COUNT");
        gr.setWorkflow(false);
        gr.addActiveQuery();
        gr.query();

        while(gr.next()) {
            var pid = gr.process_definition.toString();
            var activityName = gr.activity_definition.getDisplayValue();
            var process = processes[pid];

            if(process != undefined) {
                if(process.activities == undefined)
                    process.activities = [];                    

                process.activities.push({ nm: activityName, count: parseInt(gr.getAggregate("COUNT"))});                    
            }
        }
    })();

    return processes;
};

var getApplicationUsage = function() {
    var gr = new GlideAggregate("ua_app_usage");
    if(!gr.isValid())
        return {};

    gr.setWorkflow(false);	
    gr.addEncodedQuery("app_name=Process Automation Designer");
    gr.addAggregate("COUNT");
    gr.groupBy("time_stamp");
    gr.query();

    var months = {};

    while(gr.next()) {
        var accrualPeriod = gr.time_stamp.toString(),
            count = gr.getAggregate("COUNT");

        months[accrualPeriod] = count;
    }

    return months;
};

var setSessionLanguage = function() {
    try {
        gs.getSession().setLanguage("en");
    } catch(e) { }
};

var getCurrentLanguage = function() {
	var language = "N/A";
	try {
		language = gs.getSession().getLanguage();
	} catch(e) {}

	return language;
};

(function(){

    setSessionLanguage();

    var ranges = {
        r1: { start: 0, end: 100 },
        r2: { start: 101, end: 200 },
        r3: { start: 201, end: 300 },
        r4: { start: 301, end: 400 },
    };

	var auditResults = {
        currentLanguage: getCurrentLanguage(),
        padUsage: getApplicationUsage(),
        totalProcess: getTotalProcesses(),
        processes: getProcesses(ranges.r1)
	};

	gs.print(JSON.stringify(auditResults));

})();