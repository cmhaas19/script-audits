

/*
    <license_details>
        <allocated>N/A</allocated>
        <allocated_status>na</allocated_status>
        <auto_sync>false</auto_sync>
        <category>0</category>
        <count/>
        <display_only>false</display_only>
        <end_date/>
        <expired>false</expired>
        <is_capped>false</is_capped>
        <last_allocation_cal_on/>
        <last_tables_used_cal_on/>
        <license_id/>
        <license_type>0</license_type>
        <license_weight>-1</license_weight>
        <measured_role_types/>
        <name>License Name</name>
        <product_code/>
        <product_cost>0</product_cost>
        <quota_defn/>
        <quota_defn_id/>
        <quota_id/>
        <start_date/>
        <sys_created_by>chris.haas@snc</sys_created_by>
        <sys_created_on>2022-10-25 16:34:11</sys_created_on>
        <sys_id>a697850d973691103399796e6253af1c</sys_id>
        <sys_mod_count>0</sys_mod_count>
        <sys_updated_by>chris.haas@snc</sys_updated_by>
        <sys_updated_on>2022-10-25 16:34:11</sys_updated_on>
        <table_count>0</table_count>
        <tables_used>0</tables_used>
    </license_details>
*/
var getLicensingInfo = function() {
    var results = {};

    //
    // Licensing details
    //
    (function(){
        var gr = new GlideRecord("license_details");
        gr.setWorkflow(false);
        gr.query();

        results.licenses = [];

        while(gr.next()) {
            var license = {
                name: gr.getValue("name"),
                startDate: gr.getValue("start_date"),
                endDate: gr.getValue("end_date"),
                tableCount: gr.getValue("table_count"),
                tablesUsed: gr.getValue("tables_used"),
                productCode: gr.getValue("product_code")
            };

            results.licenses.push(license);
        }
    })();

    return results;
};


(function(){

    var results = getLicensingInfo(ranges.R1);

    gs.print(JSON.stringify(results));

})();