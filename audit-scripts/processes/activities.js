
var getActivities = function() {
    var gr = new GlideAggregate("sys_pd_activity");
    gr.setWorkflow(false);
    gr.addAggregate("COUNT");
    gr.addActiveQuery();
    gr.groupBy("process_definition");
    gr.groupBy("activity_definition");    
    gr.query();

    var results = {};

    while(gr.next()) {
        var activityId = gr.activity_definition.toString();

        if(results[activityId] == undefined)
            results[activityId] = { nm: gr.activity_definition.getDisplayValue(), pc: 0, ac: 0 };

        var activity = results[activityId];

        activity.pc++;
        activity.ac += parseInt(gr.getAggregate("COUNT"));
    }

    return results;
};

var getCurrentLanguage = function() {
	var language = "N/A";
	try {
		language = gs.getSession().getLanguage();
	} catch(e) {}

	return language;
};

(function(){

	var auditResults = {
        currentLanguage: getCurrentLanguage(),
        activities: getActivities()
	};

	gs.print(JSON.stringify(auditResults));

})();