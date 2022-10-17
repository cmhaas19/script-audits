

var StopWatch = function() {
    var start = new GlideDateTime();

    return {
        getTime: function() {
            var duration = GlideDateTime.subtract(start, new GlideDateTime());
            return duration.getNumericValue();
        }
    };
};

var TypeManager = function() {
    var _index = 0;
    var _types = {};

    return {
        getTypeIndex: function(type) {
            if(_types[type] == undefined) {
                _index++;
                _types[type] = _index.toString();
            }
            
            return _types[type];
        },
        
        getAllTypes: function() {
            return _types;
        }
    };
};

var ScopeManager = function() {
    var _scopes = {};

    var _init = function() {
        var gr = new GlideRecord("sys_scope");
        gr.setWorkflow(false);
        gr.query();

        while(gr.next()){
            _scopes[gr.getUniqueValue()] = gr.getValue("scope");
        }
    };

    _init();

    return {
        getScopeById: function(scopeId) {
            var scope = _scopes[scopeId];

            if(scope == undefined) {
                scope = "unknown";
            }

            return scope;
        },

        getScopeCount: function() {
            return Object.keys(_scopes).length;
        }
    };
};

var getCustomizations = function(dateRange) {
    var scopeManager = new ScopeManager();
    var typeManager = new TypeManager();
    var customerEdits = {};

    var results = { 
        totalScopeCount: scopeManager.getScopeCount(),
        companyCode: gs.getProperty("glide.appcreator.company.code"),
        dateRange: {
            start: dateRange.startDate.getValue(),
            end: dateRange.endDate.getValue()
        },
        created: {
            queryTime: 0,
            totalResults: 0,
            records: {}
        }, 
        modified: {
            queryTime: 0,
            totalResults: 0,
            records: {}
        }
    };

    //
    // Query 1: Join to sys_upgrade_history_log on name=file_name -> records returned here indicate customer modifications. Cache them
    //
    (function(result){
        var sw = new StopWatch();

        var gr = new GlideRecord("sys_update_xml");
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_created_onBETWEEN" + dateRange.startDate.getValue() + "@" + dateRange.endDate.getValue());
        gr.addJoinQuery("sys_upgrade_history_log", "name", "file_name");
        gr.query();

        while(gr.next()) {
            var name = gr.getValue("name"),
                type = gr.type.toString(),
                typeIndex = typeManager.getTypeIndex(type),
                scope = scopeManager.getScopeById(gr.application.toString());

            // Cache separately for use in next query
            customerEdits[name] = true;

            if(result.records[scope] == undefined)
                result.records[scope] = {};

            if(result.records[scope][typeIndex] == undefined)
                result.records[scope][typeIndex] = 0;

            result.records[scope][typeIndex] += 1;

            result.totalResults++;
        }

        result.queryTime = sw.getTime();

    })(results.modified);


    //
    // Query 2: Query sys_update_xml where name NOT IN (results from above) -> records returned here are customer net-new
    //
    (function(result){
        var sw = new StopWatch();

        var gr = new GlideAggregate("sys_update_xml");
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_created_onBETWEEN" + dateRange.startDate.getValue() + "@" + dateRange.endDate.getValue());
        gr.addQuery("name", "NOT IN", Object.keys(customerEdits).join(","));
        gr.addAggregate("COUNT");
        gr.groupBy("application");
        gr.groupBy("type");
        gr.query();

        while(gr.next()) {
            var type = gr.type.toString(),
                typeIndex = typeManager.getTypeIndex(type),
                scope = scopeManager.getScopeById(gr.application.toString()),
                count = parseInt(gr.getAggregate("COUNT"));

            if(result.records[scope] == undefined)
                result.records[scope] = {};

            if(result.records[scope][typeIndex] == undefined)
                result.records[scope][typeIndex] = 0;

            result.records[scope][typeIndex] = count;

            result.totalResults += count;
        }

        result.queryTime = sw.getTime();

    })(results.created);

    results.types = typeManager.getAllTypes();

    return results;
};

/*
    Generates start & end dates for the trailing 12 months
*/
var generateDateRanges = function() {
    var dateRanges = [];

    var today = new GlideDateTime();
    var baseDate = new GlideDateTime("2011-01-01 00:00:00");
    baseDate.setYearUTC((today.getYear() - 1));
    baseDate.setMonthUTC((today.getMonthUTC() - 1));

    for(var i = 0;i < 12;i++) {
        var startDate = new GlideDateTime(baseDate);
        startDate.addMonthsUTC(i);
        
        var endDate = new GlideDateTime(startDate);
        endDate.addMonthsUTC(1);
        endDate.addSeconds(-1);

        dateRanges.push({ startDate: startDate, endDate: endDate });
    }

    return dateRanges;
};

(function(){
    var dateRanges = generateDateRanges();

    //
    // Create 2 month date ranges and create a separate audit for each range to limit query time and payload size
    //
    var ranges = {
        "R1": { startDate: dateRanges[0].startDate, endDate: dateRanges[1].endDate },
        "R2": { startDate: dateRanges[2].startDate, endDate: dateRanges[3].endDate },
        "R3": { startDate: dateRanges[4].startDate, endDate: dateRanges[5].endDate },
        "R4": { startDate: dateRanges[6].startDate, endDate: dateRanges[7].endDate },
        "R5": { startDate: dateRanges[8].startDate, endDate: dateRanges[9].endDate },
        "R6": { startDate: dateRanges[10].startDate, endDate: dateRanges[11].endDate }
    };

    var results = getCustomizations(ranges.R1);

    gs.print(JSON.stringify(results));

})();
