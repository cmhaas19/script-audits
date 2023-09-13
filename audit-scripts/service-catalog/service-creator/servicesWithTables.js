
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

    if(companyCode == undefined || companyCode == null || companyCode.length == 0)
        return null;
        
    return companyCode;
};

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
        services: {
            total: getCount("sc_cat_item_producer_service", "active=true"),
            customTableGlobal: getCount("sc_cat_item_producer_service","active=true^table_nameSTARTSWITHu_"),
            customTableScoped: getCount("sc_cat_item_producer_service","active=true^table_nameSTARTSWITHx_" + getCompanyCode())
        },
        serviceItems: {
            total: getCount("sc_ic_item_staging", "active=true"),
            customTableGlobal: getCount("sc_ic_item_staging","active=true^table_nameSTARTSWITHu_"),
            customTableScoped: getCount("sc_ic_item_staging","active=true^table_nameSTARTSWITHx_" + getCompanyCode())
        }
    };
};

var getCustomTableInfo = function() {
    var gr = new GlideRecord("sc_cat_item_producer_service");
    gr.setWorkflow(false);
    gr.addEncodedQuery("active=true^table_nameSTARTSWITHu_^ORtable_nameSTARTSWITHx_" + getCompanyCode());
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
    var gr = new GlideAggregate("sc_ic_question");
    gr.setWorkflow(false);
    gr.groupBy("sc_ic_question_class")
    gr.addAggregate("COUNT");
    gr.query();

    var results = {};

    while(gr.next()){
        var questionClass = gr.sc_ic_question_class.getDisplayValue(),
            count = parseInt(gr.getAggregate("COUNT"));

        results[questionClass] = count;
    }

    return results;
};

(function(){

	var auditResults = {
        counts: getCounts(),
        customTables: getCustomTableInfo(),
        questionTypes: getQuestionTypes()
	};

	gs.print(JSON.stringify(auditResults));

})();