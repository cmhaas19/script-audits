

var getViewCounts = function() {
	var gr = new GlideAggregate('sys_ui_view');
	gr.setWorkflow(false);
	gr.addAggregate("COUNT");
	gr.query();

	return gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0;
};

var getInvalidViewCounts = function() {
	var pattern=/^(sys_popup,|)[A-Za-z0-9_-]+(,sys_popup|)$/i;
	var invalidNames = [];

	var gr = new GlideRecord('sys_ui_view');
	gr.setLimit(5000);
	gr.setWorkflow(false);
	gr.query();
	
	while(gr.next()) {
	    var name = gr.getValue('name');

	    if (name && !name.match(pattern)){
	        invalidNames.push(name);
	    }
	}

	return {
		total: invalidNames.length,
		names: invalidNames
	};
};

var results = {
	totalViews: getViewCounts(),
	invalidViews: getInvalidViewCounts()
};

gs.print(JSON.stringify(results));