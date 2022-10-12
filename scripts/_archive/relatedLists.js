
var gr = new GlideAggregate("sys_ui_related_list_entry");
gr.setWorkflow(false);
gr.addAggregate("COUNT");
gr.groupBy("list_id.name");
gr.groupBy("list_id.view.title");
gr.setQueryReferences(true);
gr.query();

var results = {};

var notEmpty = function(o) {
	return (o != undefined && o != null && o.length > 0);
}

while(gr.next()) {
	var table = gr.getValue("list_id.name"),
		view = gr.getValue("list_id.view.title"),
		count = parseInt(gr.getAggregate("COUNT"));

	if(notEmpty(table) && notEmpty(view)) {
		if(results[table] == undefined)
			results[table] = {};
		results[table][view] = count;
	}
}

gs.print(JSON.stringify(results));
