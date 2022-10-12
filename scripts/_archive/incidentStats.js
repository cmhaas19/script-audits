
var getTableStats = function(tableName, query) {
	var gr = new GlideAggregate(tableName);  
	gr.setWorkflow(false);
	gr.addEncodedQuery(query);
	gr.addTrend ('sys_created_on','Month');  
	gr.addAggregate('COUNT');  
	gr.setGroup(false);  
	gr.query();

	var alerts = {};

	while(gr.next()) {  
		var timeref = gr.getValue('timeref'),
			count = gr.getAggregate('COUNT');

		alerts[timeref] = count;
	}

	return alerts;

};

var getMajorIncidentColumnName = function() {
	var gr = new GlideRecord("sys_dictionary");
	gr.setWorkflow(false);
	gr.addEncodedQuery("name=incident^column_label=Major Incident");
	gr.query();

	if(gr.next())
		return gr.getValue("element");
};

var getMajorIncidentStats = function() {
	var columnName = getMajorIncidentColumnName();

	if(columnName)
		return getTableStats("incident", columnName + "=true");
};

var yearAgo = "sys_created_onRELATIVEGE@year@ago@1";

var returnValue = {
	incidentAlertsActive: pm.isRegistered("com.snc.iam"),
	incidentStats: getTableStats("incident", yearAgo),
	incidentPriorityOneStats: getTableStats("incident", "priority=1^" + yearAgo),
	incidentPriorityZeroStats: getTableStats("incident", "priority=0^" + yearAgo),
	incidentMajorStats: getMajorIncidentStats()
};

if(returnValue.incidentAlertsActive)
	returnValue.incidentAlertStats = getTableStats("incident_alert", yearAgo);

gs.print(JSON.stringify(returnValue));

