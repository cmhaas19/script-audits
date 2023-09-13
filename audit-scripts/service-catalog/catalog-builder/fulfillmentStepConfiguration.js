
var CUSTOM_APPROVAL = "2b7d9a7e87022010c84e4561d5cb0b21";
var MANAGER_APPROVAL = "38ee146053162010fca7ddeeff7b1221";
var TASK = "dc0f364873122010ae42d31ee2f6a7f3";

var getFullfillmentSteps = function() {
    var results = {
        customApprovals: [],
        managerApprovals: [],
        tasks: []
    };

    //
    // Custom approvals
    //
    (function(){
        var gr = new GlideRecord("sc_service_fulfillment_approval_step");
        gr.setWorkflow(false);
        gr.setLimit(5000);
        gr.addActiveQuery();
        gr.query();

        while(gr.next()) {
            results.customApprovals.push({
                users: gr.users.nil() ? 0 : gr.getValue("users").split(",").length,
                groups: gr.groups.nil() ? 0 : gr.getValue("groups").split(",").length,
                type: gr.getValue("approval_type"),
                cd: (gr.catalog_conditions.nil() ? false : gr.getValue("catalog_conditions").length > 0)
            });
        }
    })();

    //
    // Manager approvals
    //
    (function(){
        var gr = new GlideRecord("sc_service_fulfillment_step");
        gr.setWorkflow(false);
        gr.setLimit(5000);
        gr.addActiveQuery();
        gr.query();

        while(gr.next()) {
            results.managerApprovals.push({
                cd: (gr.catalog_conditions.nil() ? false : gr.getValue("catalog_conditions").length > 0)
            });
        }
    })();

    //
    // Tasks
    //
    (function(){
        var gr = new GlideRecord("sc_service_fulfillment_task_step");
        gr.setWorkflow(false);
        gr.setLimit(5000);
        gr.addActiveQuery();
        gr.query();

        while(gr.next()) {
            results.tasks.push({
                sd: gr.short_description.toString().length > 0,
                d: gr.description.toString().length > 0,
                ag: gr.assigned_group.toString().length > 0,
                at: gr.assigned_to.toString().length > 0,
                p: gr.priority.toString().length > 0,
                cd: (gr.catalog_conditions.nil() ? false : gr.getValue("catalog_conditions").length > 0)
            });
        }
    })();

    return results;
};

(function(){

	var auditResults = {
        fulfillmentSteps: getFullfillmentSteps()
	};

	gs.print(JSON.stringify(auditResults));

})();