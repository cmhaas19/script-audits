
var getRecordProducersByMonth = function() {
    var gr = new GlideAggregate("sc_cat_item_producer");  
	gr.setWorkflow(false);
	gr.addEncodedQuery(query);
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

(function(){

    // 01 - Get "customer created" record producers created by month
    // 02 - Get record producers by target table

	var auditResults = {
        recordProducers: getRecordProducersByMonth()
	};

	gs.print(JSON.stringify(auditResults));

})();