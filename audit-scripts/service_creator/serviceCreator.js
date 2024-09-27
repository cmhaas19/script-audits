/**
 * Example outpuut:
 * 
 * {
 *   "applicationUsage": {
 *     "Service Creator": {
 *       "2024-09": 1
 *     }
 *   },
 *   "serviceCounts": {
 *     "totalCategories": 2,
 *     "totalServices": {
 *       "2024-09": 2
 *     },
 *     "totalFulfillers": {
 *       "Sales Requests": 2,
 *       "Product Management Services": 1
 *     },
 *     "totalEditors": {
 *       "Sales Requests": 2,
 *       "Product Management Services": 2
 *     }
 *   }
 * }
 * 
 */
function initGlideRecord (tableName){
    if (!GlideTableDescriptor.isValid(tableName)) return;
    var gr = new GlideAggregate(tableName);
    if(!gr.isValid()) return;
    gr.setWorkflow(false);
    return gr;
}

var getApplicationUsage = function() {
    var appUsage = {};
    var appNames = [
        'Service Creator'
    ];

    var gr = initGlideRecord("ua_app_usage");
    if(!gr) return appUsage;
	gr.addEncodedQuery("app_nameIN" + appNames.join(","));
    gr.addAggregate("COUNT");
    gr.groupBy("app_name");
    gr.groupBy("time_stamp");
    gr.query();

    while(gr.next()) {
        var appName = gr.app_name.toString(),
            accrualPeriod = gr.time_stamp.toString(),
            count = parseInt(gr.getAggregate("COUNT"));

        if(appUsage[appName] == undefined)
            appUsage[appName] = {};

        appUsage[appName][accrualPeriod] = count;
    }

    return appUsage;
};

var getServiceCounts = function () {
    var services = [];
    // Set to -1 to indicate an issue with querying the table in the final output
    var results = {
        totalCategories: -1,
        totalServices: -1,
        totalFulfillers: -1,
        totalEditors: -1
    };

    (function(){
        var gr = initGlideRecord("catalog_category_request");
        if(!gr) return;
        gr.addAggregate("COUNT");
        gr.query();

        results.totalCategories = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

    })();

    (function(){
        var gr = initGlideRecord("sc_cat_item_producer_service");
        if(!gr) return;
        gr.query();

        var resultMap = {};

        while (gr.next()) {
            var createdOn = new GlideDateTime(gr.getValue('sys_created_on'));
            var year = createdOn.getYearUTC();  // Get the year from sys_created_on
            var month = createdOn.getMonthUTC().toString().padStart(2, '0'); // Get the month (0-based, so add 1)
            
            var yearMonth = year + '-' + month;
            
            if (!resultMap[yearMonth]) {
                resultMap[yearMonth] = 0;
            }
            
            resultMap[yearMonth] += 1; // Increment the count for this year-month pair
        }

        results.totalServices = resultMap;
    })();

    (function(){
        var gr = initGlideRecord("catalog_category_request_user");
        if(!gr) return;
        gr.addAggregate("COUNT");
        gr.groupBy("category");
        gr.query();
        var resultMap = {};
        while (gr.next()) {
            resultMap[gr.category.name.toString()] = parseInt(gr.getAggregate("COUNT"));
        }

        results.totalFulfillers = resultMap;

    })();

    (function(){
        var gr = initGlideRecord("service_category_user_role");
        if(!gr) return;
        gr.addAggregate("COUNT");
        gr.groupBy("category");
        gr.query();

        var resultMap = {};

        while (gr.next()) {
            resultMap[gr.category.name.toString()] = parseInt(gr.getAggregate("COUNT"));
        }

        results.totalEditors = resultMap;

    })();

    return results;
}

var setSessionLanguage = function() {
    try {
        gs.getSession().setLanguage("en");
    } catch(e) { }
};


(function(){

    setSessionLanguage();

    var results = {
        applicationUsage: getApplicationUsage(),
        serviceCounts: getServiceCounts()
    };

    gs.print(JSON.stringify(results));

})();