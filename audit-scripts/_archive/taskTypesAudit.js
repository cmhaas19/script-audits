

var taskTypeAudit = function() {

	var getTaskTypes = function(role) {
		var results = {};

		var gr = new GlideAggregate("task");
		gr.setWorkflow(false);
		gr.addAggregate("COUNT");
		gr.addEncodedQuery("opened_at>=javascript:gs.beginningOfLast90Days()");
		gr.groupBy("sys_class_name");

		var itilUsers = gr.addJoinQuery("sys_user_has_role", "assigned_to", "user");
		itilUsers.addCondition("role.name", "=", role);

		gr.query();

		while(gr.next()) {
			var count = gr.getAggregate("COUNT"),
				taskType = gr.sys_class_name;

			results[taskType] = count;
		}

		return results;
	};

	var results = {
		itsmTaskTypes: getTaskTypes("itil")
	};

	if(pm.isRegistered("com.sn_customerservice"))
		results.csmTaskTypes = getTaskTypes("sn_esm_agent");

	return results;
};



var results = {
	taskTypes: taskTypeAudit()
};

gs.print(JSON.stringify(results));

