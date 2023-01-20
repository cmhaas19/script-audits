
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

    if(companyCode == undefined || companyCode == null || companyCode.length == 0)
        return null;
        
    return companyCode;
};

var QUESTION_QUERY = "typeNOT IN12,20,24,19^cat_item.sys_class_name=sc_cat_item_producer^ORcat_item.sys_class_name=sc_cat_item_producer_service^cat_item.ref_sc_cat_item_producer.table_nameSTARTSWITHu_^ORcat_item.ref_sc_cat_item_producer.table_nameSTARTSWITHx_" + getCompanyCode();

var getCount = function(table, query) {
    var gr = new GlideAggregate(table);
    gr.setWorkflow(false);
    gr.addEncodedQuery(query);
    gr.addAggregate("COUNT");
    gr.query();

    return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
};

var getCounts = function() {
    return {
        total: getCount("sc_cat_item_producer", "sys_class_name=sc_cat_item_producer^ORsys_class_name=sc_cat_item_producer_service"),
        customTableGlobal: getCount("sc_cat_item_producer","sys_class_name=sc_cat_item_producer^ORsys_class_name=sc_cat_item_producer_service^table_nameSTARTSWITHu_"),
        customTableScoped: getCount("sc_cat_item_producer","sys_class_name=sc_cat_item_producer^ORsys_class_name=sc_cat_item_producer_service^table_nameSTARTSWITHx_" + getCompanyCode())
    };
};

var getCustomTableInfo = function() {
    var gr = new GlideRecord("sc_cat_item_producer");
    gr.setWorkflow(false);
    gr.addEncodedQuery("sys_class_name=sc_cat_item_producer^ORsys_class_name=sc_cat_item_producer_service^table_nameSTARTSWITHu_^ORtable_nameSTARTSWITHx_" + getCompanyCode());
    gr.query();

    var results = {
        "task": 0,
        "solo": 0
    };

    while(gr.next()){
        var tableName = gr.getValue("table_name");
        var table = new TableUtils(tableName);
        var rootTable = table.getAbsoluteBase();

        if(tableName == rootTable) {
            results["solo"]++;
            
        } else {

            if(results[rootTable] == undefined)
                results[rootTable] = 0;

            results[rootTable]++;
        }
    }

    return results;
};

var getQuestionTypes = function() {
    var gr = new GlideAggregate("item_option_new");
    gr.setWorkflow(false);
    gr.addEncodedQuery(QUESTION_QUERY);
    gr.groupBy("type")
    gr.addAggregate("COUNT");
    gr.query();

    var results = {};

    while(gr.next()){
        var questionClass = gr.type.getDisplayValue(),
            count = parseInt(gr.getAggregate("COUNT"));

        results[questionClass] = count;
    }

    return results;
};

var getQuestionMapMix = function() {
    var gr = new GlideAggregate("item_option_new");
    gr.setWorkflow(false);
    gr.addEncodedQuery(QUESTION_QUERY);
    gr.groupBy("cat_item");
    gr.groupBy("map_to_field");
    gr.addAggregate("COUNT");
    gr.query();

    var results = {};

    while(gr.next()){
        var item = gr.cat_item.toString(),
            mapToField = gr.map_to_field.toString(),
            count = parseInt(gr.getAggregate("COUNT"));

        if(results[item] == undefined)
            results[item] = { mapped: 0, unmapped: 0 };

        if(mapToField == "true")
            results[item].mapped += count;
        else
            results[item].unmapped += count;
    }

    var items = {
        total: 0,
        pureFields: 0,
        pureVariables: 0,
        mixture: 0
    };

    for(var id in results) {
        var item = results[id];

        items.total++;

        if(item.mapped > 0 && item.unmapped > 0)
            items.mixture++;
        else if(item.mapped > 0 && item.unmapped == 0)
            items.pureFields++;
        else if(item.mapped == 0 && item.unmapped > 0)
            items.pureVariables++;
    }

    return items;
};

var getQuestionMapAggregates = function() {
    var gr = new GlideAggregate("item_option_new");
    gr.setWorkflow(false);
    gr.addEncodedQuery(QUESTION_QUERY);
    gr.groupBy("map_to_field");
    gr.addAggregate("COUNT");
    gr.query();

    var results = {};

    while(gr.next()){
        var mapToField = gr.map_to_field.toString(),
            count = parseInt(gr.getAggregate("COUNT"));

        if(results[mapToField] == undefined)
            results[mapToField] = 0;

        results[mapToField] += count;
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

//
// # of record producers that have questions that purely map to fields
//  vs. # of record producers that have questions that purely don't map to fields
//  vs. # of record producers that have a mix of map vs. not
//
 
(function(){

	var auditResults = {
        counts: getCounts(),
        customTables: getCustomTableInfo(),
        questionTypes: getQuestionTypes(),
        questionMapsToFields: getQuestionMapAggregates(),
        questionMapMix: getQuestionMapMix(),
        byMonth: getRecordProducersByMonth(),
		byCategory: getRecordProducerCategoryCount()
	};

	gs.print(JSON.stringify(auditResults));

})();