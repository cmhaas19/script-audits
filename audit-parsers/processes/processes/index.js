const Audit = require('../../common/AuditWorkbook.js');
const FileLoader = require('../../common/FileLoader.js');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

var loadFiles = (instances) => {
    var promise = new Promise((resolve, reject) => {
        var combined = {};
        var totalProcesses = 0;
        var missing = {};
        var processIds = {};

        Promise.all([ 
            FileLoader.parseCsvFile("./files/process-r1.csv"), 
            FileLoader.parseCsvFile("./files/process-r2.csv"),
            FileLoader.parseCsvFile("./files/process-r3.csv"),
            FileLoader.parseCsvFile("./files/process-r4.csv")
    
        ]).then((dataSets) => {
            //
            // Combine all the processes
            //
            dataSets.forEach((dataSet) => { 
                dataSet.forEach((row) => {
                    if(row.data && row.data.processes) {
                        var instance = instances[row.instanceName];

                        if(instance != undefined && instance.purpose == "Production") {

                            if(combined[row.instanceName] == undefined)
                                combined[row.instanceName] = {};

                            if(row.data.totalProcess > 400) {
                                if(missing[row.instanceName] == undefined) {
                                    missing[row.instanceName] = (row.data.totalProcess - 400);
                                }
                            }
                            
                            for(var id in row.data.processes) {
                                var process = row.data.processes[id];

                                if(processIds[id] != undefined)
                                    continue;

                                processIds[id] = true;

                                if(combined[row.instanceName][id] == undefined || instance.purpose == "Production"){
                                    combined[row.instanceName][id] = process;
                                    totalProcesses++;
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
    
            console.log(`Found ${totalProcesses} Processes. Did not record ${missingTotal} flows across ${Object.keys(missing).length} instances`);
            
            resolve(combined);
        });
    });

    return promise;
};

var writeDetails = (workbook, instances, combined) => {
    var wsDetails = workbook.addWorksheet("Process Details");
    var wsActivities = workbook.addWorksheet("Process Activities");

    wsDetails.setColumns([
        { header: 'Instance', width: 20 },
        { header: 'Instance Purpose', width: 20 },
        { header: 'Company', width: 42 },
        { header: 'Account No.', width: 12 },
        { header: 'Account Type', width: 17 },
        { header: 'Process ID', width: 22 },
        { header: 'Process Name', width: 22 },
        { header: 'Trigger', width: 22 },
        { header: 'Total Activity Types', width: 22 },
        { header: 'Total Activities', width: 22 },
        { header: 'Created On', width: 22 },
        { header: 'Created On YYYY-MM', width: 22 }
    ]);

    wsActivities.setColumns([
        { header: 'Instance', width: 20 },
        { header: 'Instance Purpose', width: 20 },
        { header: 'Company', width: 42 },
        { header: 'Account No.', width: 12 },
        { header: 'Account Type', width: 17 },
        { header: 'Process ID', width: 22 },
        { header: 'Process Name', width: 22 },
        { header: 'Trigger', width: 22 },
        { header: 'Activity Name', width: 22 },
        { header: 'Activity Count', width: 22 }
    ]);

    for(var instanceName in combined) {
        var instance = instances[instanceName];
        var processes = combined[instanceName];

        for(var id in processes) {
            var process = processes[id];

            var detailRecord = {
                instance: instanceName,
                purpose: instance.purpose,
                company: instance.account.accountName,
                accountNo: instance.account.accountNo,
                accountType: instance.account.accountType,
                id: id,
                name: process.nm,
                trigger: process.trigger,
                activityTypes: 0,
                activities: 0,
                created: process.cd,
                createdYearMonth: moment(process.cd, "YYYY-MM-DD").format("YYYY-MM")
            };

            if(process.activities && process.activities.length > 0) {
                process.activities.forEach((p) => {
                    detailRecord.activityTypes++;
                    detailRecord.activities += p.count;

                    var activityRecord = {
                        instance: detailRecord.instance,
                        purpose: detailRecord.purpose,
                        company: detailRecord.company,
                        accountNo: detailRecord.accountNo,
                        accountType: detailRecord.accountType,
                        id: detailRecord.id,
                        name: detailRecord.name,
                        trigger: detailRecord.trigger,
                        activity: p.nm,
                        count: p.count
                    };

                    wsActivities.addRow(activityRecord);

                });
            }

            wsDetails.addRow(detailRecord);
        }
    }
};

var writeUsage = (workbook, instances, combined) => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "/files/process-r1.csv");

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var ws = workbook.addWorksheet("PAD Usage");

            ws.setStandardColumns([
                { header: 'Month', width: 20 },
                { header: 'Users', width: 20 }
            ]);

            auditData.forEach((row) => {
                if(row.data && row.data.padUsage) {
                    for(var month in row.data.padUsage) { 
                        var result = {
                            month: month,
                            count: row.data.padUsage[month]
                        };

                        ws.addStandardRow(row.instanceName, row.instance, result);
                    }
                }
            });
            
            resolve();
        });

    });

    return promise;
};

(function(){

    FileLoader.loadInstancesAndAccounts().then((instances) => {
        loadFiles(instances).then((combined) => {
            var workbook = new Audit.AuditWorkbook("./processes-results.xlsx");

            writeDetails(workbook, instances, combined);

            writeUsage(workbook, instances, combined).then(() => {
                workbook.commit().then(() => console.log("Finished!"));
            });
        });
    });

})();