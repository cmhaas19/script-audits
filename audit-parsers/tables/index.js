const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require("moment");

(function(){

    const EXCLUDED_PARENT_TABLES = {
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

    var fileName = path.join(__dirname, "custom-tables-audit.csv");       

    FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

        var wb = new Audit.AuditWorkbook("custom-table-audit.xlsx");

        var ws = wb.addWorksheet("Summary");
        var errors = wb.addWorksheet("Errors");

        ws.setStandardColumns([
            { header: 'Table Name', width: 20 },
            { header: 'Created On', width: 20 },
            { header: 'Created On YYYY-MM', width: 20 },
            { header: 'Created On YYYY', width: 20 },
            { header: 'Parent Table', width: 20 },
            { header: 'Root Table', width: 20 },
            { header: 'Full Path', width: 20 },
            { header: 'Is Global', width: 20 },
            { header: 'Is Scoped', width: 20 }
        ]);

        errors.setStandardColumns([
            { header: 'Audit State', width: 12 },
            { header: 'Error Description', width: 42 }
        ]);

        auditData.forEach((row) => {
            var isProduction = (row.instance && row.instance.purpose == "Production");

            if(isProduction) {
                if(row.success === true && row.data && row.data.customTables) {
                    var customTables = row.data.customTables;
        
                    for(var tableName in customTables) {
                        var table = customTables[tableName];    
                        var exclude = false;          

                        var record = {
                            tableName: tableName,
                            createdOn: "",
                            createdOnYearMonth: "",
                            createdOnYear: "",
                            parentTable: "",
                            rootTable: "",
                            fullPath: "",
                            isGlobal: tableName.startsWith("u_"),
                            isScoped: tableName.startsWith("x_")
                        };
        
                        if(table.createdOn && table.createdOn.length) {
                            record.createdOn = table.createdOn;
                            record.createdOnYearMonth = moment(table.createdOn).format("YYYY-MM");
                            record.createdOnYear = moment(table.createdOn).format("YYYY");
                        } 
        
                        if(table.path && table.path.length) {
                            record.parentTable = table.path[0];
                            record.rootTable = table.path[table.path.length - 1];
                            record.fullPath = table.path.join(" > ");

                            table.path.forEach((tableName) => {
                                if(EXCLUDED_PARENT_TABLES[tableName] != undefined)
                                    exclude = true;
                            });
                        } 
        
                        if(!exclude)
                            ws.addStandardRow(row.instanceName, row.instance, record);
                    }
                } else if(row.success == false) {
                    errors.addStandardRow(row.instanceName, row.instance, {
                        auditState: row.auditState, 
                        errorDescription: row.errorDescription
                    });
                }
            }
        });

        wb.commit().then(() => console.log("Finished!"));

    });

})();