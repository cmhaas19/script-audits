

var getMultipleInputsPreference = function() {

	var results = {};

	var itilUserCount = (function() {
		var gr = new GlideAggregate("sys_user");
		gr.setWorkflow(false);
		gr.addAggregate('COUNT');
		gr.addEncodedQuery("active=true^last_login_time>javascript:gs.dateGenerate('2018-02-01','00:00:00')");

		var role = gr.addJoinQuery("sys_user_has_role", "sys_id", "user");
		role.addCondition("role.name", "=", "itil");

		gr.query();

		return gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0;

	})();

	var defaultValue = (function() {
		var gr = new GlideRecord("sys_user_preference");
		gr.setWorkflow(false);
		gr.addEncodedQuery("name=glide.ui.activity_stream.multiple_inputs^userISEMPTY");
		gr.query();
		
		return gr.next() ? gr.getValue("value") == "true" : false;

	})();

	var preferenceCount = (function() {
		var preference = new GlideAggregate("sys_user_preference");
		preference.setWorkflow(false);
		preference.addAggregate('COUNT');
		preference.addEncodedQuery("name=glide.ui.activity_stream.multiple_inputs^value=" + !defaultValue);

		var fulfillers = preference.addJoinQuery("sys_user_has_role", "user", "user");
		fulfillers.addCondition("role.name", "=", "itil");
		fulfillers.addCondition("user.active", "=", "true");
		fulfillers.addCondition("user.last_login_time", ">", "javascript:gs.dateGenerate('2018-02-01','00:00:00')");

		preference.query();

		return preference.next() ? parseInt(preference.getAggregate("COUNT")) : 0;

	})();

	results.itilUserCount = itilUserCount;
	results.defaultValue = defaultValue;

	if(defaultValue == false) {
		results.multipleInputUsers = preferenceCount;
	} else {
		results.multipleInputUsers = itilUserCount - preferenceCount;
	}

	return results;
};


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
	activityFilters: getActivityFilterFields(),
	multipleInputs: getMultipleInputsPreference()
};

gs.print(JSON.stringify(returnValue));