
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require('moment');
const fs = require('fs');
const { v1: uuidv1, v4: uuidv4 } = require('uuid');


var parseCsvFile = (propertyName, auditData) => {
    var promise = new Promise((resolve, reject) => { 
        var fileName = "./files/" + propertyName + ".csv";

        FileLoader.parseCsvFile(fileName).then((data) => {
            auditData[propertyName] = data;
            resolve(auditData);
        });
    });

    return promise;
};

var loadAllFiles = (instances) => {
    var promise = new Promise((resolve, reject) => {
        var auditData = {};
        
        parseCsvFile("creatorStudio", auditData)            
            .then((auditData) => parseCsvFile("creatorStudioApps", auditData))
            .then((auditData) => parseCsvFile("creatorStudioProcesses", auditData))
            .then((auditData) => parseCsvFile("creatorStudioForms", auditData))
            .then((auditData) => {
                var combined = {};
                var missingAccountInfo = 0;

                //
                // Combine all results into one JSON object
                //
                for(var propertyName in auditData){
                    auditData[propertyName].forEach((row) => {
                        var instanceName = row.instanceName;

                        // 
                        // Only include if instance & account info actually exists
                        //
                        if(instances[instanceName] && instances[instanceName].account && instances[instanceName].account.accountName.length){
                            if(combined[instanceName] == undefined)
                                combined[instanceName] = {};

                            if(combined[instanceName][propertyName] == undefined)
                                combined[instanceName][propertyName] = [];
                            
                            combined[instanceName][propertyName].push(row);

                        } else {
                            missingAccountInfo++;
                        }
                    });
                }

                console.log(`Could not locate account info for ${missingAccountInfo} instances`);

                //
                // Now add the account info
                //
                for(var instanceName in combined) {
                    var instance = combined[instanceName];

                    if(instances[instanceName]){
                        instance.instanceInfo = instances[instanceName];
                    }
                }

                
                fs.writeFile('creator-studio.json', JSON.stringify(combined, null, 2), () => {
                    console.log("Logged json to creator-studio.json file");
                    resolve(combined);
                });
               
                resolve(combined);
            });
	});

	return promise;
};

var writeGeneralWorksheet = (workbook, auditData) => {

    var worksheet = workbook.addWorksheet("General");
    worksheet.setStandardColumns([
        { header: 'Installed', width: 13 },
        { header: 'Installed On', width: 17 },
        { header: 'Installed On YYYY-MM', width: 12 },
        { header: 'Version', width: 17 },
        { header: 'Guided Setup Status', width: 19 },
        { header: 'Guided Setup Progress', width: 20 },
        { header: 'Total Apps', width: 20 },
        { header: 'Total Forms', width: 20 },
        { header: 'Total Processes', width: 20 },
        { header: 'Total Records', width: 20 },
        { header: 'Total Fulfillers', width: 20 },
        { header: 'Pipeline Installed', width: 20 },
        { header: 'Pipelines - Total', width: 20 },
        { header: 'Pipelines - Total Environments', width: 20 }
    ]);

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.creatorStudio) {
            instance.creatorStudio.forEach(row => {

                if(row.data) {

                    var result = {
                        installed: row.data.installationDetails.installed,
                        installedOn: row.data.installationDetails.installedOn,
                        installedOnYearMonth: "",
                        version: row.data.installationDetails.version,
                        guidedSetupStatus: "",
                        guidedSetupProgress: 0,
                        totalApps: row.data.appCounts.totalApps,
                        totalForms: row.data.appCounts.totalForms,
                        totalProcesses: row.data.appCounts.totalProcesses,
                        totalRecords: row.data.appCounts.totalRecords,
                        totalFulfillers: row.data.appCounts.totalFulfillers,
                        pipelineInstalled: row.data.pipelineStats.installed,
                        pipelineCount: row.data.pipelineStats.totalPipelines,
                        environmentCount: row.data.pipelineStats.totalEnvironments,
                    };

                    if(row.data.installationDetails.installed && row.data.installationDetails.installedOn)
                        result.installedOnYearMonth = moment(row.data.installationDetails.installedOn).format("YYYY-MM");

                    if(row.data.guidedSetupStatus && row.data.guidedSetupStatus.status){
                        result.guidedSetupStatus = row.data.guidedSetupStatus.status;
                        result.guidedSetupProgress = parseInt(row.data.guidedSetupStatus.progress);
                    }

                    worksheet.addStandardRow(instanceName, instance, result);
                }                
            });
        }
    }
};

var writeCustomerWorksheet = (workbook, auditData) => {
    var customers = {};

    var getNumericVersion = (version) => {
        var value = 0;

        if(version != null && version != undefined && version.length > 0){
            value = parseInt(version.replace(/\D/g, ''));

            if(isNaN(value))
                value = 0;
        }

        return value;
    };

    //
    // Loop through entire data set and ensure we get one customer record for
    // each account and that record reflects the latest installed version and install date
    //
    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.creatorStudio) {
            instance.creatorStudio.forEach(row => {

                if(row.data && row.data.installationDetails && row.data.installationDetails.installed === true) {
                    var details = row.data.installationDetails;
                    var account = instance.instanceInfo.account;
                    var accountNo = account.accountNo;
                    var customer = customers[accountNo];

                    var numericVersion = getNumericVersion(details.version);

                    if(customer == undefined) {
                        customers[accountNo] = {
                            account: account,
                            installedOn: details.installedOn,
                            installedVersion: {
                                number: numericVersion,
                                text: details.version
                            }
                        }
                    } else {
                        if(customer.installedVersion.number < numericVersion) {
                            customer.installedVersion.number = numericVersion;
                            customer.installedVersion.text = details.version;
                        }
    
                        if(moment(details.installedOn).isBefore(customer.installedOn)){
                            customer.installedOn = details.installedOn;
                        }
                    }
                }                
            });
        }
    }

    //
    // Now we have our flat customer data set, create the worksheet
    //
    var worksheet = workbook.addWorksheet("Customers");
    worksheet.setAccountColumns([
        { header: 'Installed On', width: 17 },
        { header: 'Installed On YYYY-MM', width: 12 },
        { header: 'Version', width: 17 }
    ]);

    for(var accountNo in customers) {
        var customer = customers[accountNo];
        var account = customer.account;

        var row = {
            installedOn: customer.installedOn, 
            installedOnYearMonth: moment(customer.installedOn).format("YYYY-MM"),
            installedVersion: customer.installedVersion.text
        }
        worksheet.addAccountRow(account, row);
    }
};

var writeAppUsageWorksheetMAU = (workbook, auditData) => {
    var worksheet = workbook.addWorksheet("App Usage - Instances");
    worksheet.setStandardColumns([
        { header: 'Application', width: 14 },
        { header: 'Month', width: 8 },
        { header: 'No. of Users', width: 12 }
    ]);

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.creatorStudio) {
            instance.creatorStudio.forEach(row => {
                if(row.data && row.data.applicationUsage) {
                    for(var appName in row.data.applicationUsage){
                        var app = row.data.applicationUsage[appName];

                        for(var month in app){
                            var result = {
                                appName: appName,
                                month: month,
                                users: parseInt(app[month])
                            };
                            worksheet.addStandardRow(instanceName, instance, result);
                        }
                    }
                }
            });
        }
    }
};

var writeAppUsageWorksheetMAC = (workbook, auditData) => {
    var accounts = {};

    for(var instanceName in auditData){
        var instance = auditData[instanceName];
        var instanceInfo = instance.instanceInfo;

        if(instanceInfo.account && instanceInfo.account.accountNo && instance.creatorStudio) {
            instance.creatorStudio.forEach(row => {
                if(row.data && row.data.applicationUsage) {
                    for(var appName in row.data.applicationUsage){
                        var app = row.data.applicationUsage[appName];
                        var accountNo = instanceInfo.account.accountNo;

                        if(accounts[accountNo] == undefined)
                            accounts[accountNo] = { accountInfo: instanceInfo.account, apps: {} };

                        if(accounts[accountNo].apps[appName] == undefined)
                            accounts[accountNo].apps[appName] = {};

                        for(var month in app){
                            if(accounts[accountNo].apps[appName][month] == undefined)
                                accounts[accountNo].apps[appName][month] = 0;

                            accounts[accountNo].apps[appName][month] += parseInt(app[month]);
                        }
                    }
                }
            });
        }
    }

    var worksheet = workbook.addWorksheet("App Usage - Customers");
    worksheet.setColumns([
        { header: 'Company', width: 14 },
        { header: 'Account No', width: 14 },
        { header: 'Account Type', width: 14 },
        { header: 'App Engine Subscriber', width: 14 },
        { header: 'Application', width: 14 },
        { header: 'Month', width: 8 },
        { header: 'No. of Users', width: 12 }
    ]);

    for(var accountNo in accounts) {
        for(var appName in accounts[accountNo].apps) {
            for(var month in accounts[accountNo].apps[appName]) {
                var result = {
                    company: accounts[accountNo].accountInfo.accountName,
                    accountNo: accountNo,
                    accountType: accounts[accountNo].accountInfo.accountType,
                    appEngineSubscriber: accounts[accountNo].accountInfo.isAppEngineSubscriber,
                    appName,
                    month,
                    users: accounts[accountNo].apps[appName][month]
                };

                worksheet.addRow(result);
            }
        }
    }
};

var writeRolesWorksheets = (workbook, auditData) => {
    var worksheet = workbook.addWorksheet('Role Counts');
	
    worksheet.setStandardColumns([
        { header: 'Role Name', width: 20 },
        { header: 'No. of Users', width: 20 }
    ]);

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.creatorStudio) {
            instance.creatorStudio.forEach(row => {
                if(row.data && row.data.userRoleCounts) {
                    for(var roleName in row.data.userRoleCounts){
                        worksheet.addStandardRow(instanceName, instance, {
                            roleName: roleName, 
                            users: row.data.userRoleCounts[roleName]
                        });
                    }
                }
            });
        }
    }
};

var writeAppsWorksheets = (workbook, auditData) => {
    var worksheet = workbook.addWorksheet('Request Apps');
	
    worksheet.setStandardColumns([
        { header: 'App ID', width: 20 },
        { header: 'App Scope', width: 20 },
        { header: 'Table Name', width: 20 },
        { header: 'Created On', width: 20 },
        { header: 'Created On YYYY-MM', width: 20 },
        { header: 'Color', width: 20 },
        { header: 'Icon', width: 20 },
        { header: 'No. of Forms', width: 20 },
        { header: 'No. of Processes', width: 20 },
        { header: 'No. of Lists', width: 20 },
        { header: 'No. of Records', width: 20 },
        { header: 'No. of Fulfillers', width: 20 },
    ]);

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.creatorStudioApps) {
            instance.creatorStudioApps.forEach(row => {
                if(row.data) {
                    for(var scope in row.data){
                        var app = row.data[scope];

                        worksheet.addStandardRow(instanceName, instance, {
                            id: app.id,
                            scope: scope,
                            tableName: app.tb,
                            createdOn: app.cr,
                            createdOnYearMonth: moment(app.cr).format("YYYY-MM"),
                            color: app.cl,
                            icon: app.i,
                            forms: app.f,
                            processes: app.p,
                            lists: app.l,
                            records: app.r,
                            fulfillers: app.ff
                        });
                    }
                }
            });
        }
    }
};

var writeFormsWorksheets = (workbook, auditData) => {
    var wsTemplates = workbook.addWorksheet('Form Templates');
    var wsFieldTypes = workbook.addWorksheet('Form Field Types');
	
    wsTemplates.setStandardColumns([
        { header: 'Template Name', width: 20 },
        { header: 'No. of Forms', width: 20 }
    ]);

    wsFieldTypes.setStandardColumns([
        { header: 'Field Type', width: 20 },
        { header: 'No. of Forms Using', width: 20 },
        { header: 'No. of Instances Used', width: 20 }
    ]);

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.creatorStudioForms) {
            instance.creatorStudioForms.forEach(row => {
                if(row.data && row.data.templates) {
                    for(var templateName in row.data.templates){
                        var templateCount = row.data.templates[templateName];

                        wsTemplates.addStandardRow(instanceName, instance, {
                            templateName,
                            templateCount
                        });
                    }
                }

                if(row.data && row.data.fieldTypes) {
                    for(var fieldTypeName in row.data.fieldTypes){
                        var formCount = row.data.fieldTypes[fieldTypeName].forms;
                        var instanceCount = row.data.fieldTypes[fieldTypeName].total;

                        wsFieldTypes.addStandardRow(instanceName, instance, {
                            fieldTypeName,
                            formCount,
                            instanceCount
                        });
                    }
                }
            });
        }
    }
};

var writeProcessesWorksheets = (workbook, auditData) => {
    var wsProcesses = workbook.addWorksheet('Processes');
    var wsActivities = workbook.addWorksheet('Process Activities');
	
    wsProcesses.setStandardColumns([
        { header: 'Process ID', width: 20 },
        { header: 'App Scope', width: 20 },
        { header: 'Process Type', width: 20 },
        { header: 'Trigger Type', width: 20 },
        { header: 'Trigger Condition', width: 20 }
    ]);

    wsActivities.setStandardColumns([
        { header: 'Process ID', width: 20 },
        { header: 'App Scope', width: 20 },
        { header: 'Process Type', width: 20 },
        { header: 'Activity Name', width: 20 },
        { header: 'Activity Order', width: 20 },
        { header: 'Activity Condition', width: 20 }
    ]);

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.creatorStudioProcesses) {
            instance.creatorStudioProcesses.forEach(row => {
                if(row.data) {
                    row.data.forEach((process) => {
                        var p = {
                            id: uuidv4(),
                            scope: process.scope,
                            processType: process.type,
                            // triggerType: process.trigger.type,
                            triggerCondition: ""
                        };

                        if(process.trigger && process.trigger.type) {
                            p.triggerType = process.trigger.type;
                        }

                        if(process.trigger && process.trigger.v && process.trigger.v.Condition) {
                            p.triggerCondition = process.trigger.v.Condition;
                        }

                        wsProcesses.addStandardRow(instanceName, instance, p);

                        if(process.activities && process.activities.length){
                            process.activities.forEach((activity) => {
                                var a = {
                                    id: p.id,
                                    scope: process.scope,
                                    processType: process.type,
                                    activityName: activity.nm,
                                    activityOrder: parseInt(activity.o),
                                    condition: activity.c
                                };

                                wsActivities.addStandardRow(instanceName, instance, a);
                            });
                        }
                    });                    
                }
            });
        }
    }
};

var writeErrorsWorksheets = (workbook, auditData) => {
    var worksheet = workbook.addWorksheet('Errors');

    worksheet.setStandardColumns([
        { header: 'Audit', width: 8 },
        { header: 'Audit State', width: 12 },
        { header: 'Error Description', width: 42 }
    ]);

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        for(var auditName in instance) {
            var audit = instance[auditName];

            if(Array.isArray(audit)){
                audit.forEach((row) => {

                    if(!row.success && instanceName != "Instance Name" && instanceName != "u_instance_name") {
                        worksheet.addStandardRow(instanceName, instance, {
                            auditName, 
                            auditState: row.auditState, 
                            errorDescription: row.errorDescription
                        });
                    }
                });
            }
        }
    }
};

(function(){

    FileLoader.loadInstancesAndAccounts()
        .then(loadAllFiles)
        .then((auditData) => {

            var workbook = new Audit.AuditWorkbook("./creator-studio-results.xlsx");

            writeGeneralWorksheet(workbook, auditData);
            console.log("Created General Worksheet");

            writeCustomerWorksheet(workbook, auditData);
            console.log("Created Customer Worksheet");

            writeAppUsageWorksheetMAU(workbook, auditData);
            console.log("Created App Usage MAU Worksheet");

            writeAppUsageWorksheetMAC(workbook, auditData);
            console.log("Created App Usage MAC Worksheet");

            writeRolesWorksheets(workbook, auditData);
            console.log("Created Roles Worksheet");

            writeAppsWorksheets(workbook, auditData);
            console.log("Created Apps Worksheet");

            writeFormsWorksheets(workbook, auditData);
            console.log("Created Forms Worksheet");

            writeProcessesWorksheets(workbook, auditData);
            console.log("Created Processes Worksheet");

            writeErrorsWorksheets(workbook, auditData);
            console.log("Created Errors Worksheet");

            workbook.commit().then(() => console.log("Finished!"));
        });

})();