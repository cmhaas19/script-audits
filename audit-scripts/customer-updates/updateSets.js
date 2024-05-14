(function () {
	var gr = new GlideAggregate("sys_update_set");
	gr.setWorkflow(false);
	/*
	 * When remote update sets are installed the `install_date` field is set via
	 * the code here: https://code.devsnc.com/dev/glide/blob/19e211a042adbb6a4ba007d3f6e6d9bbb35b42ae/glide/src/com/glide/update/UpdateSet.java#L741-L749
	 * Per David Leonard: 
	 * This will only count remote update sets installed, if you also want local update sets completed then you'll want to make the query condition OR install_dateISEMPTY^state=complete
	 */
	gr.addEncodedQuery("install_dateISNOTEMPTY");
	gr.addTrend("install_date", "Month");
	gr.addAggregate("COUNT");
	gr.setGroup(false);
	gr.query();
  
	var months = {};
  
	while (gr.next()) {
	  var month = gr.getValue("timeref");
	  months[month] = parseInt(gr.getAggregate("COUNT"));
	}
  
	gs.print(JSON.stringify(months));
  })();