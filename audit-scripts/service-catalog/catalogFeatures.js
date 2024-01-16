
var createYear = function() {
    return { 
        catalogItems: { total: 0, uiPolicyTotal: 0, questionSetTotal: 0, autoPopulateTotal: 0, topicAssignmentTotal: 0 }, 
        recordProducers: { total: 0, uiPolicyTotal: 0, questionSetTotal: 0, autoPopulateTotal: 0, topicAssignmentTotal: 0 } 
    };
};

var createQuery = function() {
    var gr = new GlideAggregate('sc_cat_item');
    gr.setWorkflow(false);
    gr.groupBy("sys_class_name");
    gr.addAggregate('COUNT');
    gr.addEncodedQuery("active=true^sys_class_name=sc_cat_item^ORsys_class_name=sc_cat_item_producer");
    gr.addTrend ('sys_created_on', 'Year');

    return gr;
};

var getCatalogUsage = function() {

    var years = {};

    //
    // Get catalog items && record producers by year
    //
    (function(){
        var gr = createQuery();
        gr.query();

        while(gr.next()) {  
            var year = gr.getValue('timeref'),
                className = gr.getValue("sys_class_name");
    
            if(years[year] == undefined)
                years[year] = createYear();

            if(className == "sc_cat_item")
                years[year].catalogItems.total = parseInt(gr.getAggregate('COUNT'));

            if(className == "sc_cat_item_producer")
                years[year].recordProducers.total = parseInt(gr.getAggregate('COUNT'));
        }

    })();

    //
    // Same query but do a join to catalog UI policy
    //
    (function(){
        var gr = createQuery();
        var join = gr.addJoinQuery("catalog_ui_policy", "sys_id", "catalog_item");
        gr.query();

        while(gr.next()) {  
            var year = gr.getValue('timeref'),
                className = gr.getValue("sys_class_name");
    
            if(years[year] == undefined)
                years[year] = createYear();

            if(className == "sc_cat_item")
                years[year].catalogItems.uiPolicyTotal = parseInt(gr.getAggregate('COUNT'));

            if(className == "sc_cat_item_producer")
                years[year].recordProducers.uiPolicyTotal = parseInt(gr.getAggregate('COUNT'));
        }

    })();

    //
    // Same query but do a join to figure out Question Set usage
    //
    (function(){
        var gr = createQuery();
        var join = gr.addJoinQuery("io_set_item", "sys_id", "sc_cat_item");
        gr.query();

        while(gr.next()) {  
            var year = gr.getValue('timeref'),
                className = gr.getValue("sys_class_name");
    
            if(years[year] == undefined)
                years[year] = createYear();

            if(className == "sc_cat_item")
                years[year].catalogItems.questionSetTotal = parseInt(gr.getAggregate('COUNT'));

            if(className == "sc_cat_item_producer")
                years[year].recordProducers.questionSetTotal = parseInt(gr.getAggregate('COUNT'));
        }

    })();

    //
    // Same query but do a join to figure out Auto-populate usage
    //
    (function(){
        var gr = createQuery();
        var join = gr.addJoinQuery("item_option_new", "sys_id", "cat_item");
        join.addCondition("dynamic_value_field", "!=", "NULL");
        gr.query();

        while(gr.next()) {  
            var year = gr.getValue('timeref'),
                className = gr.getValue("sys_class_name");
    
            if(years[year] == undefined)
                years[year] = createYear();

            if(className == "sc_cat_item")
                years[year].catalogItems.autoPopulateTotal = parseInt(gr.getAggregate('COUNT'));

            if(className == "sc_cat_item_producer")
                years[year].recordProducers.autoPopulateTotal = parseInt(gr.getAggregate('COUNT'));
        }

    })();

    //
    // Same query but do a join to figure out Topic assignment usage
    //
    (function(){
        var gr = createQuery();
        var join = gr.addJoinQuery("m2m_connected_content", "sys_id", "catalog_item");
        gr.query();

        while(gr.next()) {  
            var year = gr.getValue('timeref'),
                className = gr.getValue("sys_class_name");
    
            if(years[year] == undefined)
                years[year] = createYear();

            if(className == "sc_cat_item")
                years[year].catalogItems.topicAssignmentTotal = parseInt(gr.getAggregate('COUNT'));

            if(className == "sc_cat_item_producer")
                years[year].recordProducers.topicAssignmentTotal = parseInt(gr.getAggregate('COUNT'));
        }

    })();

    return years;
};


(function(){

	var auditResults = {
        catalogItems: getCatalogUsage()
	};

	gs.print(JSON.stringify(auditResults));

})();
