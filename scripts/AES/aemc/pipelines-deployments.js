
var getDeploymentCounts = function() {
    var months = {};

    //
    // Old Deployment Table
    //
    (function(){
        var gr = new GlideAggregate("sn_app_eng_studio_deployment_request");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.addEncodedQuery("app_sys_id!=NULL");
        gr.addTrend("sys_created_on", 'Month');
        gr.addAggregate("COUNT");
        gr.setGroup(false);
        gr.query();

        while(gr.next()){
            var month = gr.getValue("timeref");

            if(months[month] == undefined)
                months[month] = { oldModel: 0, newModel: 0 };

            months[month].oldModel = parseInt(gr.getAggregate("COUNT"));
        }        
    })();

    //
    // New Deployment Table
    //
    (function(){
        var gr = new GlideAggregate("sn_deploy_pipeline_deployment_request");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.addEncodedQuery("app_sys_id!=NULL");
        gr.addTrend("sys_created_on", 'Month');
        gr.addAggregate("COUNT");
        gr.setGroup(false);
        gr.query();

        while(gr.next()){
            var month = gr.getValue("timeref");

            if(months[month] == undefined)
                months[month] = { oldModel: 0, newModel: 0 };

            months[month].newModel = parseInt(gr.getAggregate("COUNT"));
        }        
    })();

    return months;
};

var getInstallationStatus = function() {
    var response = {
        oldModelInstalled: false,
        newModelInstalled: false
    };

    var oldGr = new GlideRecord("sn_app_eng_studio_deployment_request");
    response.oldModelInstalled = oldGr.isValid();

    var newGr = new GlideRecord("sn_deploy_pipeline_deployment_request");
    response.newModelInstalled = newGr.isValid();

    return response;
};

var getDeploymentRequestsByState = function() {
    var gr = new GlideAggregate("sn_deploy_pipeline_deployment_request");

    if(!gr.isValid())
        return data;

    gr.setWorkflow(false);
    gr.groupBy("state");
    gr.addAggregate("COUNT");
    gr.query();

    var data = {};

    while(gr.next()){
        var state = gr.getValue("state");
        data[state] = parseInt(gr.getAggregate("COUNT"));
    }

    return data;
};

var getPipelineConfigurations = function() {
    var pipelines = {};

    (function(){
        var gr = new GlideRecord("sn_pipeline_pipeline");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.setLimit(100);
        gr.query();

        while(gr.next()) {
            pipelines[gr.getUniqueValue()] = {
                name: gr.getValue("name"),
                active: (gr.getValue("active") == "1"),
                createdOn: gr.getValue("sys_created_on"),
                type: {
                    id: gr.getValue("pipeline_type"),
                    name: gr.pipeline_type.getDisplayValue()
                },
                sourceEnvironment: {
                    id: gr.getValue("source_environment"),
                    name: gr.source_environment.getDisplayValue()
                },
                environments: []
            }
        }
    })();

    (function(){
        var gr = new GlideRecord("sn_pipeline_pipeline_environment_order");

        if(!gr.isValid())
            return;
            
        gr.setWorkflow(false);
        gr.orderBy("order");
        gr.query();

        while(gr.next()) {
            var id = gr.getValue("pipeline");
  
            pipelines[id].environments.push({
                order: gr.getValue("order"),
                environment: {
                    id: gr.environment.sys_id.toString(),
                    name: gr.environment.name.toString(),
                    instanceId: gr.environment.instance_id.toString(),
                    instanceType: gr.environment.type.getDisplayValue(),
                    instanceUrl: gr.environment.instance_url.toString(),
                    isController: gr.environment.is_controller.toString()
                }
            });
        }
    })();
    
    return pipelines;
};


(function(){

    var results = {
        installationStatus: getInstallationStatus(),
        deploymentRequests: getDeploymentCounts(),
        deploymentRequestsByState: getDeploymentRequestsByState(),
        pipelineConfigurations: getPipelineConfigurations()
    };

    gs.print(JSON.stringify(results));

})();