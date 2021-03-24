
(function(){

	var results = {};

	var gr = new GlideAggregate("sysapproval_approver");
	gr.addEncodedQuery("sys_created_onRELATIVEGT@dayofweek@ago@365");
	gr.addAggregate('COUNT', "source_table");
	gr.setWorkflow(false);
	gr.query();

	while(gr.next()) {
		results[gr.source_table.toString()] = gr.getAggregate("COUNT", "source_table");
	}

	gs.print(JSON.stringify(results));

})();