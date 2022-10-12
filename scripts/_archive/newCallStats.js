
function getItilUserCount() {
	var gr = new GlideAggregate("sys_user_has_role");
	gr.setWorkflow(false);
	gr.addEncodedQuery("user.active=true^role.name=itil");
	gr.addAggregate("COUNT");
	gr.query();

	return (gr.next() ? gr.getAggregate("COUNT") : 0);
}

//
// Gets stats based on record counts
//
function getNewCallStatistics() {

	var getTransactionStats = function(daysAgo) {

		var gr = new GlideAggregate("new_call");
		gr.addEncodedQuery("opened_atRELATIVEGT@dayofweek@ago@" + daysAgo);
		gr.addAggregate('COUNT');
		gr.setWorkflow(false);
		gr.query();

		return (gr.next() ? gr.getAggregate("COUNT") : 0);
	};

	return {
		"30": getTransactionStats(30),
		"90": getTransactionStats(90),
		"180": getTransactionStats(180),
		"365": getTransactionStats(365)
	};
}

var output = {
	enabled: pm.isRegistered("com.snc.service_desk_call")
};

if(output.enabled) {
	output.recordStatistics = getNewCallStatistics();
	output.itilUsers = getItilUserCount();
}

gs.print(JSON.stringify(output));



