



// How many list definitions does this customer have?

// How many do they have with dot-walkable fields?

// GOTOname=incident^viewSTARTSWITHrpt

var map = {};

var gr = new GlideAggregate("sys_ui_list_element");
gr.setWorkflow(false);
gr.addEncodedQuery("elementLIKE.^list_id.nameINincident,problem,change_request,task_sla^element!=.begin_split^ORelement=NULL^element!=.end_split^ORelement=NULL");
gr.addAggregate("COUNT", "list_id");
gr.query();

while(gr.next()) {
	var table = gr.list_id.getDisplayValue();

	if(map[table] == undefined)
		map[table] = 0;

	map[table]++;
}

gs.print(JSON.stringify(map));