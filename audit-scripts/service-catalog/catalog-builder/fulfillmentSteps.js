
var getFullfillmentSteps = function() {
    var gr = new GlideAggregate("sc_service_fulfillment_step");
    gr.setWorkflow(false);
    gr.addAggregate("COUNT");
    gr.addActiveQuery();
    gr.groupBy("service_fulfillment_stage.cat_item");
    gr.groupBy("service_fulfillment_step_configuration");    
    gr.query();

    var results = {};

    while(gr.next()) {
        var activityId = gr.service_fulfillment_step_configuration.toString();

        if(results[activityId] == undefined)
            results[activityId] = { name: gr.service_fulfillment_step_configuration.getDisplayValue(), items: 0, total: 0 };

        var activity = results[activityId];

        activity.items++;
        activity.total += parseInt(gr.getAggregate("COUNT"));
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
        fulfillmentSteps: getFullfillmentSteps()
	};

	gs.print(JSON.stringify(auditResults));

})();