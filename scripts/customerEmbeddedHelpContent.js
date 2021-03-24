
(function(){

	var gr = new GlideAggregate("sys_embedded_help_content");
	gr.setWorkflow(false);
	gr.addAggregate("COUNT");
	gr.addEncodedQuery("snc_created=false");
	gr.query();

	var count = gr.next() ? gr.getAggregate("COUNT") : 0;

	gs.print(count);

})();
