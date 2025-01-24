

function getGovernanceTaskCounts() {
    var deploymentTasks = 0;
    var collaborationTasks = 0;
    var intakeTasks = 0;
    var monthQuery = "sys_created_onONLast month@javascript:gs.beginningOfLastMonth()@javascript:gs.endOfLastMonth()";

    (function(){
        var gr = new GlideAggregate('sn_deploy_pipeline_deployment_request');

        if(!gr.isValid())
            return;

        gr.addAggregate('COUNT');
        gr.addEncodedQuery(monthQuery);
        gr.query();
    
        deploymentTasks = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
    })();

    (function(){
        var gr = new GlideAggregate('sn_collab_request_dev_collab_task');

        if(!gr.isValid())
            return;

        gr.addAggregate('COUNT');
        gr.addEncodedQuery(monthQuery);
        gr.query();
    
        collaborationTasks = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
    })();

    (function(){
        var gr = new GlideAggregate('sn_aemc_ir_list_view');

        if(!gr.isValid())
            return;
        
        gr.addAggregate('COUNT');
        gr.addEncodedQuery("r_" + monthQuery);
        gr.query();
    
        intakeTasks = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
    })();
   
    return deploymentTasks + collaborationTasks + intakeTasks;
};

answer = getGovernanceTaskCounts();