const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const ExcelJS = require('exceljs');
const fs = require('fs');
const fastCsv = require("fast-csv");
const { format } = require('@fast-csv/format');
const moment = require("moment");

var loadAllFiles = () => {
    return Promise.all([ 
        FileLoader.parseCsvFile(path.join(__dirname, "results-r1.csv")),
        FileLoader.parseCsvFile(path.join(__dirname, "results-r2.csv")),
        FileLoader.parseCsvFile(path.join(__dirname, "results-r3.csv")),
        FileLoader.parseCsvFile(path.join(__dirname, "results-r4.csv")),
        FileLoader.parseCsvFile(path.join(__dirname, "results-r5.csv")),
        FileLoader.parseCsvFile(path.join(__dirname, "results-r6.csv"))

    ]);
};

const HR_SCOPES = [
    'sn_ca',
    'sn_cd',
    'sn_ci_analytics',
    'sn_cianalytics_cmp',
    'sn_dt',
    'sn_dt_spoke',
    'sn_esign',
    'sn_ex_sp_pro',
    'sn_hr_integr_fw',
    'sn_hr_mobile',
    'sn_hr_nlu',
    'sn_hr_va',
    'sn_hr_core',
    'sn_hr_integrations',
    'sn_hr_le',
    'sn_ibm_trans_spoke',
    'sn_nlu_discovery',
    'sn_ms_trans_spoke',
    'sn_language_change',
    'sn_lds_spoke',
    'sn_msc',
    'sn_trans_commons',
    'sn_analytics_api',
    'sn_topic_recommend'
];

const CSM_SCOPES = [
    'sn_account_hier',
    'sn_account_hierarc',
    'sn_action_status',
    'sn_aisearch_global',
    'sn_app_cs_social',
    'sn_apptmnt_booking',
    'sn_casetypes_selec',
    'sn_chars',
    'sn_comm_management',
    'sn_component_produ',
    'sn_contributor',
    'sn_cs_base_ext',
    'sn_cs_queryrules',
    'sn_cs_sm',
    'sn_cs_sm_request',
    'sn_cs_time_record',
    'sn_csm_act_stat',
    'sn_csm_ah',
    'sn_csm_case_digest',
    'sn_csm_case_types',
    'sn_csm_doctemplate',
    'sn_csm_household',
    'sn_csm_lv',
    'sn_csm_mobile',
    'sn_csm_portal',
    'sn_csm_proxy_cont',
    'sn_csm_uni_th_data',
    'sn_csm_uni_theme',
    'sn_csm_workspace',
    'sn_csm_workspace_c',
    'sn_csm_wrkspc',
    'sn_csm.awa',
    'sn_csp_portal',
    'sn_customer_actvty',
    'sn_customer_feed',
    'sn_customercentral',
    'sn_customerservice',
    'sn_cwf_wrkspc',
    'sn_cwf_ws_int',
    'sn_doc',
    'sn_fsm_ah',
    'sn_fsm_pm',
    'sn_ib_chars',
    'sn_install_base',
    'sn_lookup_verify',
    'sn_majorissue_mgt',
    'sn_notes_template',
    'sn_openframe',
    'sn_openframe_uxb',
    'sn_prd_pm',
    'sn_query_rules',
    'sn_sensitive_data',
    'sn_skill_cfg_page',
    'sn_skill_rule',
    'sn_uib_lookup',
];

var flattenRecords = (records, fileTypes) => {
    var reverseTypes = {};
    var flattenedRecords = [];

    for(var fileTypeName in fileTypes) {
        var indexValue = fileTypes[fileTypeName];
        reverseTypes[indexValue] = fileTypeName;
    }

    for(var scope in records) {
        for(var fileTypeIndex in records[scope]) {
            var fileTypeName = reverseTypes[fileTypeIndex];
            flattenedRecords.push({ scope: scope, fileType: fileTypeName, count: records[scope][fileTypeIndex] });
        }
    }

    return flattenedRecords;
};

var loadData = () => {
    var promise = new Promise((resolve, reject) => {
        //
        // Load instances & accounts once
        //
        FileLoader.loadInstancesAndAccounts().then((instances) => {
            //
            // Load each result file
            //
            loadAllFiles().then((dataSets) => {
                //
                // Now merge the dataSets with the instance data
                //
                var auditData = {};

                var aggregate = (instance, scope, fileType) => {
                    var scopes = instance.customerUpdates;

                    if(scopes[scope] == undefined)
                        scopes[scope] = {};

                    if(scopes[scope][fileType] == undefined)
                        scopes[scope][fileType] = { created: 0, modified: 0 };

                    return scopes[scope][fileType];
                };

                dataSets.forEach((dataSet) => {
                    dataSet.forEach((row) => {
                        var instanceName = row.instanceName,
                            instanceInfo = instances[instanceName],
                            data = row.data;

                        if(instanceInfo == undefined) {
                            console.log(`Could not find instance ${instanceName}`);
                            return;
                        }

                        if(data == undefined) {
                            return;
                        }

                        if(auditData[instanceName] == undefined) {
                            auditData[instanceName] = { 
                                instanceInfo: instanceInfo,
                                auditSummaries: [],
                                customerUpdates: { } 
                            };
                        }

                        var instance = auditData[instanceName];

                        instance.auditSummaries.push({
                            startDate: data.dateRange.start,
                            endDate: data.dateRange.end,
                            created: { queryTime: data.created.queryTime, totalRecords: data.created.totalResults },
                            modified: { queryTime: data.modified.queryTime, totalRecords: data.modified.totalResults }
                        });

                        flattenRecords(data.created.records, data.types).forEach((record) => {
                            aggregate(instance, record.scope, record.fileType).created += record.count;
                        });

                        flattenRecords(data.modified.records, data.types).forEach((record) => {
                            aggregate(instance, record.scope, record.fileType).modified += record.count;
                        });
                    });
                });

                resolve(auditData);

                /*
                auditData: {
                    instanceName: {
                        instanceInfo: { ..., account: ... },
                        auditSummaries: { 
                            startDate: ...,
                            endDate: ...,
                            created: { queryTime: 0, totalRecords: 0 },
                            modified: { queryTime: 0, totalRecords: 0 }
                        },
                        customerUpdates: { 
                            startDate: ...,
                            endDate: ...,
                            scopes: {
                                scope_name: { 
                                    fileTypeName: { created: 0, modified: 0 },
                                    fileTypeName: { created: 0, modified: 0 },
                                    fileTypeName: { created: 0, modified: 0 }
                                }
                            }
                        }
                    }
                }
            */

            });
        });
    });

    return promise;
};

var loadPackages = () => {
    var fileName = path.join(__dirname, "packages.csv");

    /*
        Group by labels, keep the label/table combination
    */

    var promise = new Promise((resolve, reject) => {
        FileLoader.parseCsvFile(fileName).then((auditData) => {
            var packages = {};
    
            auditData.forEach((row) => {
                if(row.data && row.data.currentLanguage && row.data.currentLanguage == "en") {
                    for(var tableName in row.data.artifactPackages) {
                        var package = row.data.artifactPackages[tableName];
                        var label = package.lbl;

                        if(label != undefined && label != null) {
                            if(packages[label] == undefined)
                                packages[label] = {};

                            if(packages[label][tableName] == undefined)
                                packages[label][tableName] = { count: 0, pkg: package.pkg };

                            packages[label][tableName].count++;
                        }
                    }
                }
                
            });

            var labelPackages = {};

            for(var label in packages) {
                var occurence = 0;

                labelPackages[label] = { tableName: "", package: "", label: label };

                for(var tableName in packages[label]) {
                    var package = packages[label][tableName];

                    if(package.count > occurence) {
                        occurence = package.count;
                        labelPackages[label].tableName = tableName;
                        labelPackages[label].package = package.pkg;
                    }
                }
            }

            resolve(labelPackages);
        });
    });

    return promise;
};

var createCsvFile = (auditData) => {
    const fileName = path.join(__dirname, 'customer-updates.csv');
    const csvFile = fs.createWriteStream(fileName);
    const stream = format({ headers:true });
    stream.pipe(csvFile);

    var recordsWritten = 0;

    for(var instanceName in auditData) {
        var instance = auditData[instanceName];

        for(var scopeName in instance.customerUpdates) {
            var scope = instance.customerUpdates[scopeName];

            for(var fileTypeName in scope) {
                stream.write({ 
                    instanceName: instanceName,
                    accountNo: instance.instanceInfo.accountNo,
                    scope: scopeName, 
                    fileType: fileTypeName,
                    created: scope[fileTypeName].created,
                    modified: scope[fileTypeName].modified
                });

                recordsWritten++;

                if(recordsWritten % 100000 == 0)
                    console.log(`Wrote ${recordsWritten} records`);
            }
        }
    }

    console.log(`Done. Wrote ${recordsWritten} records`);

    stream.end();
};

var createAggregatedCsvFile = (workbook, auditData, packages) => {
    var ws = workbook.addWorksheet("Updates - Aggregated");
    var recordsWritten = 0;
    var records = {};

    ws.setColumns([
        { header: 'Table Name', width: 22 },
        { header: 'File Type', width: 22 },
        { header: 'Package', width: 22 },
        { header: 'No. of Scopes', width: 22 },
        { header: 'No. of Accounts', width: 22 },
        { header: 'Created', width: 22 },
        { header: 'Modified', width: 22 },
        { header: 'Is CSM Related', width: 22 },
        { header: 'Is HR Related', width: 22 }
    ]);

    for(var instanceName in auditData) {
        var instance = auditData[instanceName];

        for(var scopeName in instance.customerUpdates) {
            var scope = instance.customerUpdates[scopeName];

            for(var fileTypeName in scope) {

                if(records[fileTypeName] == undefined)
                    records[fileTypeName] = { scopes: {}, accounts: {}, created: 0, modified: 0 };

                var fileType = records[fileTypeName];
                
                fileType.scopes[scopeName] = true;
                fileType.accounts[instance.instanceInfo.accountNo] = true;
                fileType.created += scope[fileTypeName].created;
                fileType.modified += scope[fileTypeName].modified;
            }
        }
    }

    for(var fileTypeName in records) {
        var fileType = records[fileTypeName];
        var foundPackage = packages[fileTypeName];

        var record = {
            tableName: "",
            fileType: fileTypeName,
            package: "",
            scopes: Object.keys(fileType.scopes).length,
            accounts: Object.keys(fileType.accounts).length,
            created: fileType.created,
            modified: fileType.modified,
            isCsmRelated: (CSM_SCOPES.indexOf(scopeName) != -1),
            isHrRelated: (HR_SCOPES.indexOf(scopeName) != -1)
        };

        if(foundPackage != undefined) {
            record.tableName = foundPackage.tableName;
            record.package = foundPackage.package;
        }

        ws.addRow(record);

        recordsWritten++;
    }

    console.log(`Done creating aggregated worksheet. Wrote ${recordsWritten} records`);
};

var createScopeWorksheet = (workbook, auditData, packages) => {
    var ws = workbook.addWorksheet("Updates - By scope");
    var recordsWritten = 0;
    var allScopes = {};

    ws.setColumns([
        { header: 'Scope', width: 22 },
        { header: 'Table Name', width: 22 },
        { header: 'File Type', width: 22 },
        { header: 'Package', width: 22 },
        { header: 'No. of Accounts', width: 22 },
        { header: 'Created', width: 22 },
        { header: 'Modified', width: 22 },
        { header: 'Is CSM Related', width: 22 },
        { header: 'Is HR Related', width: 22 }
    ]);

    for(var instanceName in auditData) {
        var instance = auditData[instanceName];

        for(var scopeName in instance.customerUpdates) {
            var scope = instance.customerUpdates[scopeName];

            if(allScopes[scopeName] == undefined)
                allScopes[scopeName] = {};

            for(var fileTypeName in scope) {

                if(allScopes[scopeName][fileTypeName] == undefined)
                    allScopes[scopeName][fileTypeName] = { accounts: {}, created: 0, modified: 0 };

                var fileType = allScopes[scopeName][fileTypeName];
                
                fileType.accounts[instance.instanceInfo.accountNo] = true;
                fileType.created += scope[fileTypeName].created;
                fileType.modified += scope[fileTypeName].modified;
            }
        }
    }

    for(var scopeName in allScopes){
        for(var fileTypeName in allScopes[scopeName]) {
            var fileType = allScopes[scopeName][fileTypeName];
            var foundPackage = packages[fileTypeName];
    
            var record = {
                scope: scopeName,
                tableName: "",
                fileType: fileTypeName,
                package: "",
                accounts: Object.keys(fileType.accounts).length,
                created: fileType.created,
                modified: fileType.modified,
                isCsmRelated: (CSM_SCOPES.indexOf(scopeName) != -1),
                isHrRelated: (HR_SCOPES.indexOf(scopeName) != -1)
            };
    
            if(foundPackage != undefined) {
                record.tableName = foundPackage.tableName;
                record.package = foundPackage.package;
            }
    
            ws.addRow(record);
    
            recordsWritten++;
        }
    }
    
    console.log(`Done creating scopes worksheet. Wrote ${recordsWritten} records`);
};

var createUpdatesWorksheet = (auditData, wb) => {
    var ws = wb.addWorksheet("Updates - By File Type");
    var rowCount = 0;

    ws.columns = [
        { header: 'Type Name', width: 20 },
        { header: 'Count - Created', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Count - Modified', width: 20, alignment: { horizontal: 'right' } }
    ];
    ws.autoFilter = { from: 'A1', to: 'C1' };

    var aggregateByType = {};

    //
    // Aggregate by type
    // 
    for(var instanceName in auditData) {
        var instance = auditData[instanceName];

        for(var scopeName in instance.customerUpdates) {
            var scope = instance.customerUpdates[scopeName];

            for(var fileTypeName in scope) {
                if(aggregateByType[fileTypeName] == undefined)
                    aggregateByType[fileTypeName] = { created: 0, modified: 0 };

                aggregateByType[fileTypeName].created += scope[fileTypeName].created;
                aggregateByType[fileTypeName].modified += scope[fileTypeName].modified;
            }
        }
    }

    //
    // Now write the results
    //
    for(var fileTypeName in aggregateByType) {
        var fileType = aggregateByType[fileTypeName];

            ws.addRow([
                fileTypeName,
                fileType.created,
                fileType.modified
            ]).commit();
            
            rowCount++;
    }

    console.log(`UpdatesWorksheet: completed writing ${rowCount} rows`);

    ws.commit();
};

(function(){

    loadPackages().then((packages) => {
        loadData().then((auditData) => {

            //createCsvFile(auditData);
            //console.log("Completed creating the big CSV file");

            var wb = new Audit.AuditWorkbook("./customer-updates.xlsx");

            createScopeWorksheet(wb, auditData, packages);

            createAggregatedCsvFile(wb, auditData, packages);

            wb.commit().then(() => console.log("Finished!"));
    
            //createSummaryWorksheet(auditData, wb);
            //console.log("Completed Summary Worksheet");
            
            //createUpdatesWorksheet(auditData, wb);
            //console.log("Completed Updates By Type Worksheet");
    
        });
    });
    

})();