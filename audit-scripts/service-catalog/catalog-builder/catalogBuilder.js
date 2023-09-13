
var createMonth = function() {
    return { 
        catalogItems: { total: 0, builder: 0 }, 
        recordProducers: { total: 0, builder: 0 } 
    };
};

var getCatalogUsage = function() {

    var months = {};

    //
    // Get catalog items && record producers by month/year
    //
    (function(){
        var gr = new GlideAggregate('sc_cat_item');
        gr.setWorkflow(false);
        gr.groupBy("sys_class_name");
        gr.addAggregate('COUNT');
        gr.addEncodedQuery("sys_class_name=sc_cat_item^ORsys_class_name=sc_cat_item_producer");
        gr.addTrend ('sys_created_on', 'Month');
        gr.query();

        while(gr.next()) {  
            var month = gr.getValue('timeref'),
                className = gr.getValue("sys_class_name");
    
            if(months[month] == undefined)
                months[month] = createMonth();

            if(className == "sc_cat_item")
                months[month].catalogItems.total = parseInt(gr.getAggregate('COUNT'));

            if(className == "sc_cat_item_producer")
                months[month].recordProducers.total = parseInt(gr.getAggregate('COUNT'));
        }

    })();

    //
    // Get record producers items by month/year
    //
    (function(){
        var gr = new GlideAggregate('catalog_channel_analytics');
        gr.setWorkflow(false);
        gr.addEncodedQuery("catalog_item=91edb87273221010c84e2bb43cf6a7ae^ORcatalog_item=3558cf50c7321010159ca1e603c2605b");
        gr.groupBy("catalog_item");
        gr.addAggregate('COUNT');
        gr.addTrend ('sys_created_on', 'Month');
        gr.query();

        while(gr.next()) {  
            var month = gr.getValue('timeref'),
                catalogItem = gr.catalog_item.toString();

            if(months[month] == undefined)
                months[month] = createMonth();

            if(catalogItem == "3558cf50c7321010159ca1e603c2605b")
                months[month].recordProducers.builder = parseInt(gr.getAggregate('COUNT'));
            else
                months[month].catalogItems.builder = parseInt(gr.getAggregate('COUNT'));
        }

    })();

    return months;
};

var getFulfillmentStepUsage = function() {

    var result = {
        totalItems: 0,
        totalItemsWithFulfillmentSteps: 0
    };

    //
    // Query catalog_channel_analytics and get a total count of catalog items
    //
    (function(){
        var gr = new GlideAggregate('catalog_channel_analytics');
        gr.setWorkflow(false);
        gr.addEncodedQuery("catalog_item=91edb87273221010c84e2bb43cf6a7ae");
        gr.addAggregate('COUNT');
        gr.query();

        result.totalItems = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
    })();


    //
    // Query catalog_channel_analytics again and also do a join to the fulfillment steps table. This will get a count of items w/ fulfillment steps
    //
    (function(){
        var gr = new GlideAggregate('catalog_channel_analytics');
        gr.setWorkflow(false);
        gr.addEncodedQuery("catalog_item=91edb87273221010c84e2bb43cf6a7ae");
        gr.addAggregate('COUNT');
        
        var join = gr.addJoinQuery("sc_service_fulfillment_step", "document_key", "service_fulfillment_stage.cat_item");

        gr.query();

        result.totalItemsWithFulfillmentSteps = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
    })();

    return result;
};

var getFullfillmentSteps = function() {
    var gr = new GlideAggregate("sc_service_fulfillment_step");
    gr.setWorkflow(false);
    gr.addAggregate("COUNT");
    gr.addActiveQuery();
    gr.groupBy("service_fulfillment_stage.cat_item");
    gr.groupBy("service_fulfillment_step_configuration");    
    gr.query();

    var results = {};

    while(gr.next()) {
        var activityId = gr.service_fulfillment_step_configuration.toString();

        if(results[activityId] == undefined)
            results[activityId] = { name: gr.service_fulfillment_step_configuration.getDisplayValue(), items: 0, total: 0 };

        var activity = results[activityId];

        activity.items++;
        activity.total += parseInt(gr.getAggregate("COUNT"));
    }

    return results;
};

var getApplicationUsage = function() {
    var gr = new GlideAggregate("ua_app_usage");
    if(!gr.isValid())
        return {};

    gr.setWorkflow(false);	
    gr.addEncodedQuery("app_name=Service Catalog Builder");
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

(function(){

	var auditResults = {
        catalogItems: getCatalogUsage(),
        fulfillmentUsage: getFulfillmentStepUsage(),
        fulfillmentSteps: getFullfillmentSteps(),
        catalogBuilderUsage: getApplicationUsage()
	};

	gs.print(JSON.stringify(auditResults));

})();