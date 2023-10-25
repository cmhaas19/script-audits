
var getCustomTables = function() {

    var excludedTables = {};
    var excludedParentTables = {
        cmdb: true,
        cmdb_ci: true,
        cmdb_qb_result_base: true,
        cmn_location: true,
        cmn_schedule_condition: true,
        dl_definition: true,
        dl_matcher: true,
        kb_knowledge: true,
        sc_cat_item_delivery_task: true,
        sc_service_fulfillment_step: true,
        scheduled_data_import: true,
        sf_state_flow: true,
        sys_auth_profile: true,
        sys_dictionary: true,
        sys_choice: true,
        sys_filter: true,
        sys_hub_action_type_base: true,
        sys_import_set_row: true,
        sys_portal_page: true,
        sys_report_import_table_parent: true,
        sys_transform_script: true,
        sys_transform_map: true,
        sys_user_preference: true,
        sysauto: true,
        syslog: true,
        syslog0000: true,
        syslog0001: true,
        syslog0002: true,
        syslog0003: true,
        syslog0004: true,
        syslog0005: true,
        syslog0006: true,
        syslog0007: true
    };    

    //
    // Get m2m tables
    //
    (function(){
        var gr = new GlideRecord("sys_m2m");
        gr.setWorkflow(false);
        gr.query();

        while(gr.next()){
            var tableName = gr.getValue("m2m_table");
            excludedTables[tableName] = true;
        }
    })();

    //
    // Get Table Shards
    //
    (function(){
        var gr = new GlideRecord("sys_table_rotation_schedule");
        gr.addQuery('name.name', 'NSAMEAS', 'table_name');
        gr.setWorkflow(false);
        gr.query();

        while(gr.next()){
            var tableName = gr.getValue("table_name");
            excludedTables[tableName] = true;
        }

    })();

    //
    // Populate parent exclusions with all the tables that extend from them
    //
    (function(){
        Object.keys(excludedParentTables).forEach(function(parentTableName){
            var table = new TableUtils(parentTableName);

            j2js(table.getTableExtensions()).forEach(function(extendedTable){
                if(excludedParentTables[extendedTable] == undefined)
                    excludedParentTables[extendedTable] = true;
            });
        });
    })();

    //
    // Build the query
    //
    var query = "nameSTARTSWITHx_" + gs.getProperty("glide.appcreator.company.code");
    query += "^ORnameSTARTSWITHu_";
    query += "^scriptable_table=false^ORscriptable_tableISEMPTY";
    query += "^nameNOT LIKEar_%";
    query += "^nameNOT IN" + Object.keys(excludedTables).join(",");
    query += "^super_class.nameNOT IN" + Object.keys(excludedParentTables).join(",");
    query += "^ORsuper_classISEMPTY";

    var results = {
        companyCode: gs.getProperty("glide.appcreator.company.code"),
        totalCustomTables: 0,
        months: {}
    };

    //
    // Get custom tables
    //
    (function(){
        var gr = new GlideRecord("sys_db_object");
        gr.addEncodedQuery(query);
        gr.setWorkflow(false);
        gr.query();

        while(gr.next()) {
            var tableName = gr.getValue("name");
            var isGlobal = tableName.startsWith("u_");
            var isScoped = tableName.startsWith("x_");
            var createdOn = new GlideDateTime(gr.getValue("sys_created_on"));
            var month = createdOn.getMonth().toString();

            if(month.length == 1)
                month = "0" + month;

            month += "/" + createdOn.getYear().toString();

            if(results.months[month] == undefined)
                results.months[month] = { scoped: 0, global: 0, total: 0};

            results.months[month].total++;

            if(isGlobal)
                results.months[month].global++;

            if(isScoped)
                results.months[month].scoped++;

            results.totalCustomTables++;
        }

    })();

    return results;
};


(function(){

	var auditResults = getCustomTables();

	gs.print(JSON.stringify(auditResults));

})();