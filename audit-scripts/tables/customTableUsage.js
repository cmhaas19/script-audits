
var getCustomTableUsage = function(range) {

    var parseToIntOrZero = function(input) {
        // Attempt to parse the input as an integer
        const parsed = parseInt(input, 10);
        
        // Check if the parsed result is a valid number
        if (isNaN(parsed)) {
            return 0;
        }
        
        return parsed;
    }

    var tables = {};
    
    (function(){
        var gr = new GlideAggregate("ua_ct_usage");
        gr.setWorkflow(false);
        gr.groupBy("table_name");
        gr.groupBy("time_stamp");
        gr.addAggregate("sum", "insert_count");
        gr.addAggregate("sum", "update_count");
        gr.addAggregate("sum", "delete_count");
        gr.query();

        while(gr.next()) {
            var tableName = gr.table_name.toString();
            var month = gr.time_stamp.toString();

            if(tables[tableName] == undefined)
                tables[tableName] = {};

            if(tables[tableName][month] == undefined)
                tables[tableName][month] = {
                    i: 0,
                    u: 0,
                    d: 0
                };

            tables[tableName][month].i += parseToIntOrZero(gr.getAggregate("sum", "insert_count"));
            tables[tableName][month].u += parseToIntOrZero(gr.getAggregate("sum", "update_count"));
            tables[tableName][month].d += parseToIntOrZero(gr.getAggregate("sum", "delete_count"));
        }

    })();

    return tables;
};


(function(){

	var auditResults = getCustomTableUsage();

	gs.print(JSON.stringify(auditResults));

})();