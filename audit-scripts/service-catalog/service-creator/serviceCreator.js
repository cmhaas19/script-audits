
var getApplicationUsage = function() {
    var gr = new GlideAggregate("ua_app_usage");
    if(!gr.isValid())
        return {};

    gr.setWorkflow(false);	
    gr.addEncodedQuery("app_name=Service Creator");
    gr.addAggregate("COUNT");
    gr.groupBy("time_stamp");
    gr.query();

    var months = {};

    while(gr.next()) {
        var accrualPeriod = gr.time_stamp.toString(),
            count = gr.getAggregate("COUNT");

        months[accrualPeriod] = count;
    }

    return months;
};

var getServicesByMonth = function() {
    var gr = new GlideAggregate("sc_cat_item_producer_service");  
	gr.setWorkflow(false);
	gr.addTrend ('sys_created_on','Month');  
	gr.addAggregate('COUNT');  
	gr.setGroup(false);  
	gr.query();

	var results = {};

	while(gr.next()) {  
		var month = gr.getValue('timeref'),
			count = parseInt(gr.getAggregate('COUNT'));

        results[month] = count;
	}

	return results;
};

var getServiceWorkflows = function() {
    var gr = new GlideRecord("sc_cat_item_producer_service");  
	gr.setWorkflow(false);
	gr.query();

    var results = {
        totalItems: 0,
        totalWithWorkflow: 0,
        workflowDetails: {
            approvalNotifications: { items: 0, total: 0 },
            assignments: { user: 0, group: 0 },
            approvals: { },
            completionNotifications: { items: 0, total: 0 },
            submissionNotifications: { items: 0, total: 0 },
        }
    };

    while(gr.next()) {
        results.totalItems++;
        
        if(!gr.processing_workflow.mil()) {
            var workflowJSON = gr.getValue("processing_workflow");
            var wf = JSON.parse(workflowJSON);

            if(wf.approval_notifications != undefined && wf.approval_notifications.length) {
                results.workflowDetails.approvalNotifications.items++;
                results.workflowDetails.approvalNotifications.total += wf.approval_notifications.length;
            }

            if(wf.assignments != undefined) {
                if(wf.assignments.sys_user != undefined && wf.assignments.sys_user.value != undefined && wf.assignments.sys_user.value.length > 0) {
                    results.workflowDetails.assignments.user++;
                }
                if(wf.assignments.sys_user_group != undefined && wf.assignments.sys_user_group.value != undefined && wf.assignments.sys_user_group.value.length > 0) {
                    results.workflowDetails.assignments.group++;
                }
            }

            if(wf.approvals != undefined && wf.approvals.length) {
                for(var i = 0;i < wf.approvals.length;i++) {
                    var approval = wf.approvals[i];

                    if(results.workflowDetails.approvals[approval.value] == undefined)
                        results.workflowDetails.approvals[approval.value] = 0;

                    results.workflowDetails.approvals[approval.value]++;
                }
            }

            if(wf.completion_notifications != undefined && wf.completion_notifications.length) {
                results.workflowDetails.completionNotifications.items++;
                results.workflowDetails.completionNotifications.total += wf.completion_notifications.length;
            }

            if(wf.submission_notifications != undefined && wf.submission_notifications.length) {
                results.workflowDetails.submissionNotifications.items++;
                results.workflowDetails.submissionNotifications.total += wf.submission_notifications.length;
            }

            results.totalWithWorkflow++;
        }
    }

    return results;
};

(function(){

	var auditResults = {
        usage: getApplicationUsage(),
        services: getServicesByMonth(),
		workflows: getServiceWorkflows()
	};

	gs.print(JSON.stringify(auditResults));

})();