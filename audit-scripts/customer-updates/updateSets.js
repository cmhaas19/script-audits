
(function() {

	var gr = new GlideAggregate("sys_upgrade_history");
	gr.setWorkflow(false);
	gr.addEncodedQuery("history_type=update_set");
	gr.addTrend("sys_created_on", 'Month');
	gr.addAggregate("COUNT");
	gr.setGroup(false);
	gr.query();

	var months = {};

	while(gr.next()){
		var month = gr.getValue("timeref");
		months[month] = parseInt(gr.getAggregate("COUNT"));
	}

	gs.print(JSON.stringify(months));

})();
