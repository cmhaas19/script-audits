const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require("moment");

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

var loadFiles = (instances) => {
    var promise = new Promise((resolve, reject) => {
        var combined = {};
        var totalTables = 0;
        var missing = {};

        Promise.all([ 
            FileLoader.parseCsvFile("./audit files/tables-r1.csv"), 
            FileLoader.parseCsvFile("./audit files/tables-r2.csv"),
            FileLoader.parseCsvFile("./audit files/tables-r3.csv"),
            FileLoader.parseCsvFile("./audit files/tables-r4.csv"),
            FileLoader.parseCsvFile("./audit files/tables-r5.csv")
    
        ]).then((dataSets) => {
            //
            // Combine all the tables
            //
            dataSets.forEach((dataSet) => { 
                dataSet.forEach((row) => {
                    if(row.data && row.data.customTables) {
                        var instance = instances[row.instanceName];

                        if(instance != undefined && instance.purpose == "Production") {

                            if(combined[row.instanceName] == undefined)
                                combined[row.instanceName] = {};

                            if(row.data.totalCustomTables > 2000) {
                                if(missing[row.instanceName] == undefined) {
                                    missing[row.instanceName] = (row.data.totalCustomTables - 2000);
                                }
                            }
                            
                            for(var id in row.data.customTables) {
                                var table = row.data.customTables[id];

                                if(combined[row.instanceName][id] == undefined){
                                    combined[row.instanceName][id] = table;
                                    totalTables++;
                                }
                            }
                        }
                    }
                });
            });

            //
            // Report out the missing processes
            //
            var missingTotal = 0;
            for(var instanceName in missing) {
                missingTotal += missing[instanceName];
            }
    
            console.log(`Found ${totalTables} custom tables. Did not record ${missingTotal} tables across ${Object.keys(missing).length} instances`);
            
            resolve(combined);
        });
    });

    return promise;
};

var writeDetails = (workbook, instances, combined) => {
    var wsDetails = workbook.addWorksheet("Custom Table Details");

    wsDetails.setColumns([
        { header: 'Instance', width: 20 },
        { header: 'Instance Purpose', width: 20 },
        { header: 'Company', width: 42 },
        { header: 'Account No.', width: 12 },
        { header: 'Account Type', width: 17 },
        { header: 'App Engine Subscriber', width: 17 },
        { header: 'Table Name', width: 20 },
        { header: 'Created On', width: 20 },
        { header: 'Created On YYYY-MM', width: 20 },
        { header: 'Created On YYYY', width: 20 },
        { header: 'Parent Table', width: 20 },
        { header: 'Root Table', width: 20 },
        { header: 'Is Global', width: 20 },
        { header: 'Is Scoped', width: 20 }
    ]);

    for(var instanceName in combined) {
        var instance = instances[instanceName];
        var customTables = combined[instanceName];

        for(var tableName in customTables) {
            var table = customTables[tableName];    

            var record = {
                instance: instanceName,
                purpose: instance.purpose,
                company: instance.account.accountName,
                accountNo: instance.account.accountNo,
                accountType: instance.account.accountType,
                isAppEngineSubscriber: instance.account.isAppEngineSubscriber,
                tableName: tableName,
                createdOn: "",
                createdOnYearMonth: "",
                createdOnYear: "",
                parentTable: "",
                rootTable: "",
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

                /*
                table.path.forEach((nm) => {
                    if(EXCLUDED_PARENT_TABLES[nm] != undefined)
                        exclude = true;
                });
                */ 
            }            

            wsDetails.addRow(record);
        }
    }
};

var writeSummary = (workbook, instances, combined) => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "/audit files/tables-r1.csv");

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var ws = workbook.addWorksheet("Custom Table Summary");

            ws.setStandardColumns([
                { header: 'Total Custom Tables', width: 20 },
                { header: 'Excluded Custom Tables', width: 20 },
                { header: 'Excluded Parent Tables', width: 20 }
            ]);

            auditData.forEach((row) => {
                if(row.data && row.data.totalCustomTables) {
                    ws.addStandardRow(row.instanceName, row.instance, {
                        total: row.data.totalCustomTables,
                        excluded: row.data.excludedCount,
                        excludedParent: row.data.parentExcludedCount
                    });
                }
            });
            
            resolve();
        });

    });

    return promise;
};

var writeAggregates = (workbook) => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "/audit files/aggregates.csv");

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wsSummary = workbook.addWorksheet("Summary");
            var wsSummaryByMonth = workbook.addWorksheet("Summary - By Month");

            wsSummary.setColumns([
                { header: 'Instance', width: 42 },
                { header: 'Instance Purpose', width: 12 },
                { header: 'Company', width: 42 },
                { header: 'Account No.', width: 12 },
                { header: 'Account Type', width: 17 },                
                { header: 'App Engine Subscriber', width: 22 },
                { header: 'Total Custom Tables', width: 20 }
            ]);

            wsSummaryByMonth.setColumns([
                { header: 'Instance', width: 42 },
                { header: 'Instance Purpose', width: 12 },
                { header: 'Company', width: 42 },
                { header: 'Account No.', width: 12 },
                { header: 'Account Type', width: 17 },                
                { header: 'App Engine Subscriber', width: 22 },
                { header: 'Created On YYYY-MM', width: 22 },
                { header: 'Created On YYYY', width: 22 },
                { header: 'Created On Quarter', width: 22 },
                { header: 'Scoped Tables', width: 20 },
                { header: 'Global Tables', width: 20 },
                { header: 'Total Tables', width: 20 }
            ]);

            auditData.forEach((row) => {
                if(row.data && row.data.months) {
                    var customer = row.instance.account;

                    for(var month in row.data.months) {
                        var tables = row.data.months[month];
                        
                        wsSummaryByMonth.addRow({
                            instanceName: row.instanceName,
                            purpose: row.instance.purpose,
                            company: customer.accountName,
                            accountNo: customer.accountNo,
                            accountType: customer.accountType,                        
                            isAppEngineSubscriber: customer.isAppEngineSubscriber,
                            createdOnYearMonth: moment(month, "M/YYYY").format("YYYY-MM"),
                            createdOnYear: moment(month, "M/YYYY").format("YYYY"),
                            createdOnQuarter: `${moment(month, "M/YYYY").format("YYYY")}-Q${moment(month, "M/YYYY").quarter()}`,
                            scoped: tables.scoped,
                            global: tables.global,
                            total: tables.total
                        });
                    }
                    
                    wsSummary.addRow({
                        instanceName: row.instanceName,
                        purpose: row.instance.purpose,
                        company: customer.accountName,
                        accountNo: customer.accountNo,
                        accountType: customer.accountType,                        
                        isAppEngineSubscriber: customer.isAppEngineSubscriber,
                        total: row.data.totalCustomTables
                    });
                }
            });
            
            console.log("Completed writing aggregate summaries");
            resolve();
        });

    });

    return promise;
};

(function(){

    FileLoader.loadInstancesAndAccounts().then((instances) => {
        loadFiles(instances).then((combined) => {
            var workbook = new Audit.AuditWorkbook("./custom-table-results.xlsx");

            writeAggregates(workbook).then(() => {
                writeDetails(workbook, instances, combined);
                workbook.commit().then(() => console.log("Finished!"));
            });
        });
    });

})();