

var getActivityFilterFields = function() {
	var gr = new GlideRecord("sys_properties");
	gr.setWorkflow(false);
	gr.addEncodedQuery("nameINglide.ui.change_request_activity.fields,glide.ui.incident_activity.fields,glide.ui.problem_activity.fields,glide.ui.sn_customerservice_escalation_activity.fields,glide.ui.sn_customerservice_case_activity.fields");
	gr.query();

	var data = {};

	while(gr.next()) {
		var name = gr.getValue("name"),
			value = gr.getValue("value");

		data[name] = value.split(",");
	}	

	return data;
};



var returnValue = {
	activityFilters: getActivityFilterFields()
};

gs.print(JSON.stringify(returnValue));