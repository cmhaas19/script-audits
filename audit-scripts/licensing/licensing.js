
var getLicensingInfo = function() {
    var results = {};

    //
    // Licensing details
    //
    (function(){
        var gr = new GlideRecord("license_details");
        gr.setWorkflow(false);
        gr.setLimit(1000);
        gr.query();

        results.licenses = [];

        while(gr.next()) {
            var license = {
                name: gr.getValue("name"),
                startDate: gr.getValue("start_date"),
                endDate: gr.getValue("end_date"),
                tableCount: gr.getValue("table_count"),
                tablesUsed: gr.getValue("tables_used"),
                productCode: gr.getValue("product_code"),
                allocated: gr.getValue("allocated"),
                allocatedStatus: gr.getValue("allocated_status"),
                expired: gr.getValue("expired"),
                createdOn: gr.getValue("sys_created_on")
            };

            results.licenses.push(license);
        }
    })();

    return results;
};


(function(){

    var results = getLicensingInfo();

    gs.print(JSON.stringify(results));

})();