const path = require('path');
const sharedData = require('../shared/shared');
const ExcelJS = require('exceljs');
const fs = require('fs');
const fastCsv = require("fast-csv");
const { format } = require('@fast-csv/format');
const moment = require("moment");

var generateColumns = (values) => {
    var columns = [
        { header: 'Instance Name', width: 22 },
        { header: 'Company', width: 42 },
        { header: 'Account No.', width: 12 },
        { header: 'Account Type', width: 17 },
        { header: 'Primary Rep', width: 22 },
        { header: 'Solution Consultant', width: 23 },
        { header: 'App Engine Subscriber', width: 22 },
        { header: 'Instance Version', width: 63 },
        { header: 'Instance Purpose', width: 16 },
    ];

    return columns.concat(values);
};

var generateRowValues = (instanceName, instance, values) => {
    var rowValues = [];

    if(instance && instance.account) {
        var account = instance.account;
        rowValues = [instanceName, account.accountName, account.accountNo, account.accountType, account.primarySalesRep, account.solutionConsultant, account.isAppEngineSubscriber, instance.version, instance.purpose];
    }                
    else {
        rowValues = [instanceName,"","","","","","","",""];
    }
        

    return rowValues.concat(values);
};

var loadAllFiles = () => {
    return Promise.all([ 
        sharedData.parseCsvFile(path.join(__dirname, "results-r1.csv")),
        sharedData.parseCsvFile(path.join(__dirname, "results-r2.csv")),
        sharedData.parseCsvFile(path.join(__dirname, "results-r3.csv")),
        sharedData.parseCsvFile(path.join(__dirname, "results-r4.csv")),
        sharedData.parseCsvFile(path.join(__dirname, "results-r5.csv")),
        sharedData.parseCsvFile(path.join(__dirname, "results-r6.csv"))

    ]);
};

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
        sharedData.loadInstancesAndAccounts().then((instances) => {
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

var createSummaryWorksheet = (auditData, wb) => {

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

    var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
        filename: "customer-updates.xlsx"
    });

    loadData().then((auditData) => {

        createCsvFile(auditData);
        console.log("Completed creating the CSV file");

        //createSummaryWorksheet(auditData, wb);
        //console.log("Completed Summary Worksheet");
        
        //createUpdatesWorksheet(auditData, wb);
        //console.log("Completed Updates By Type Worksheet");
        
        wb.commit().then(() => {
            console.log("Done");
        });
    });

})();