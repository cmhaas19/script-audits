
var getCustomTables = function() {

    var excludedTables = {};
    var excludedParentTables = {
        cmdb: true,
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
    };

    var customTables = {};

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
    // Now get custom tables
    //
    (function(){
        var query = "nameSTARTSWITHx_" + gs.getProperty("glide.appcreator.company.code");
        query += "^ORnameSTARTSWITHu_";
        query += "^scriptable_table=false^ORscriptable_tableISEMPTY";
        query += "^nameNOT LIKEar_%";
        query += "^nameNOT IN" + Object.keys(excludedTables).join(",");
        query += "^super_class.nameNOT IN" + Object.keys(excludedParentTables).join(",");
        query += "^ORsuper_classISEMPTY";

        var gr = new GlideRecord("sys_db_object");
        gr.addEncodedQuery(query);
        gr.setWorkflow(false);
        gr.query();

        while(gr.next()) {
            var tableName = gr.getValue("name");
            var tableHierarchy = new TableUtils(tableName);
            
            customTables[tableName] = {};

            var path = j2js(tableHierarchy.getHierarchy()).slice(1);

            if(path.length > 0)
                customTables[tableName].path = path;
        }

    })();

    //
    // Get reference fields of these custom tables
    //
    (function(){
        var gr = new GlideRecord("sys_dictionary");
        gr.setWorkflow(false);
        gr.addEncodedQuery("internal_type=reference^nameIN" + Object.keys(customTables).join(","));
        gr.query();

        while(gr.next()) {
            var tableName = gr.getValue("name");
            var referencedTableName = gr.getValue("reference");            
            var customTable = customTables[tableName];

            if(customTable.refs == undefined)
                customTable.refs = {};

            if(customTable.refs[referencedTableName] == undefined)
                customTable.refs[referencedTableName] = 0;

            customTable.refs[referencedTableName]++;            
        }

    })();

    //
    // Get tables that reference any of the custom tables
    //
    (function(){
        var gr = new GlideRecord("sys_dictionary");
        gr.setWorkflow(false);
        gr.addEncodedQuery("nameNOT LIKEvar__^referenceIN" + Object.keys(customTables).join(","));
        gr.query();

        while(gr.next()) {
            var tableName = gr.getValue("name");
            var referencedTableName = gr.getValue("reference");
            var customTable = customTables[referencedTableName];

            if(customTable.refsBy == undefined)
                customTable.refsBy = {};

            if(customTable.refsBy[tableName] == undefined)
                customTable.refsBy[tableName] = 0;

            customTable.refsBy[tableName]++;            
        }

    })();

    return {
        companyCode: gs.getProperty("glide.appcreator.company.code"),
        customTables: customTables,
        customTableCount: Object.keys(customTables).length,
        excludedCount: Object.keys(excludedTables).length,
        parentExcludedCount: Object.keys(excludedParentTables).length
    };
};


(function(){

	var auditResults = getCustomTables();

	gs.print(JSON.stringify(auditResults));

})();