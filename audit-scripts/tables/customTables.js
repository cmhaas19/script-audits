
var getCustomTables = function(range) {

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

    var customTables = {};
    var totalCustomTables = 0;

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

    //
    // Get the total count of custom tables
    //
    (function(){
        var gr = new GlideAggregate("sys_db_object");
        gr.setWorkflow(false);
        gr.addAggregate("COUNT");
        gr.addEncodedQuery(query);
        gr.query();

        totalCustomTables = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

    })();

    //
    // Now get custom tables
    //
    (function(){
        var gr = new GlideRecord("sys_db_object");
        gr.addEncodedQuery(query);
        gr.setWorkflow(false);
        gr.orderBy("sys_id");
		gr.chooseWindow(range.start, range.end);
        gr.query();

        while(gr.next()) {
            var tableName = gr.getValue("name");
            var tableHierarchy = new TableUtils(tableName);
            
            customTables[tableName] = {
                createdOn: new GlideDateTime(gr.getValue("sys_created_on")).getDate().getValue()
            };

            var path = j2js(tableHierarchy.getHierarchy()).slice(1);

            if(path.length > 0)
                customTables[tableName].path = path;
        }

    })();

    return {
        companyCode: gs.getProperty("glide.appcreator.company.code"),
        totalCustomTables: totalCustomTables,
        excludedCount: Object.keys(excludedTables).length,
        parentExcludedCount: Object.keys(excludedParentTables).length,
        customTables: customTables,  
    };
};


(function(){

    var ranges = {
        r1: { start: 0, end: 400 },
        r2: { start: 401, end: 800 },
        r3: { start: 801, end: 1200 },
        r4: { start: 1201, end: 1600 },
        r5: { start: 1601, end: 2000 },
    };

	var auditResults = getCustomTables(ranges.r1);

	gs.print(JSON.stringify(auditResults));

})();