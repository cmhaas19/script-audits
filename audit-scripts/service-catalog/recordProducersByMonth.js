var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

    if(companyCode == undefined || companyCode == null || companyCode.length == 0)
        return "";
        
    return companyCode;
};

var getRecordProducersByMonth = function() {
    var gr = new GlideAggregate("sc_cat_item_producer");  
	gr.setWorkflow(false);
	gr.addEncodedQuery("table_nameSTARTSWITHx_" + getCompanyCode() + "^ORtable_nameSTARTSWITHu_^sys_class_name=sc_cat_item_producer^ORsys_class_name=sc_cat_item_producer_service");
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

var getRecordProducerCategoryCount = function() {
	var gr = new GlideAggregate("sc_cat_item_category");  
	gr.setWorkflow(false);
	gr.addEncodedQuery("sc_cat_item.sys_class_name=sc_cat_item_producer^ORsc_cat_item.sys_class_name=sc_cat_item_producer_service");
	gr.groupBy("sc_cat_item");
	gr.addAggregate('COUNT');  
	gr.query();

	var results = {};

	while(gr.next()) {  
		var item = gr.getValue('sc_cat_item'),
			count = gr.getAggregate('COUNT');

		if(results[count] == undefined)
			results[count] = 0;

        results[count]++;
	}

	return results;
};

var getRecordProducerQuestions = function() {

};

(function(){

    // 01 - Get "customer created" record producers created by month (look for table's that start with u_ or x_)
	// 02 - Get the # of categories associated ({ 'id': categoryCount })
    // 02 - Get record producers by target table, then get the root table

	var auditResults = {
        byMonth: getRecordProducersByMonth(),
		byCategory: getRecordProducerCategoryCount()
	};

	gs.print(JSON.stringify(auditResults));

})();