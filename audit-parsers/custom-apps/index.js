
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

var loadAESFiles = () => {
    var promise = new Promise((resolve, reject) => {
        var combined = {};
        var totalApps = 0;

        Promise.all([ 
            FileLoader.parseCsvFile("./audit-files/aes-r1.csv"), 
            FileLoader.parseCsvFile("./audit-files/aes-r2.csv"),
            FileLoader.parseCsvFile("./audit-files/aes-r3.csv"),
            FileLoader.parseCsvFile("./audit-files/aes-r4.csv")
    
        ]).then((dataSets) => {
            dataSets.forEach((dataSet) => { 
                dataSet.forEach((row) => {
                    if(row.data && row.data.apps) {
                        if(combined[row.instanceName] == undefined)
                            combined[row.instanceName] = {};
                        
                        for(var id in row.data.apps) {
                            if(id == "null")
                                continue;

                            combined[row.instanceName][id] = {
                                createdOn: row.data.apps[id],
                                installedOn: "",
                                isSysApp: false,
                                isSysStoreApp: false,
                                isAESApp: true
                            };

                            totalApps++;
                        }
                    }
                })
            });
    
            console.log(`Found ${totalApps} AES Apps`);
            resolve(combined);
        });
    });

    return promise;
};

var loadSysAppFiles = () => {
    var promise = new Promise((resolve, reject) => {
        var combined = {};
        var totalApps = 0;

        Promise.all([ 
            FileLoader.parseCsvFile("./audit-files/sys-app-r1.csv"), 
            FileLoader.parseCsvFile("./audit-files/sys-app-r2.csv"),
            FileLoader.parseCsvFile("./audit-files/sys-app-r3.csv"),
            FileLoader.parseCsvFile("./audit-files/sys-app-r4.csv")
    
        ]).then((dataSets) => {
            dataSets.forEach((dataSet) => { 
                dataSet.forEach((row) => {
                    if(row.data && row.data.customApps && row.data.customApps.apps) {
                        if(combined[row.instanceName] == undefined)
                            combined[row.instanceName] = {};

                        for(var id in row.data.customApps.apps) {
                            var app = row.data.customApps.apps[id];

                            combined[row.instanceName][id] = {
                                createdOn: app,
                                installedOn: "",
                                isSysApp: true,
                                isSysStoreApp: false,
                                isAESApp: false
                            };

                            totalApps++;
                        }
                    }
                })
            });
    
            console.log(`Found ${totalApps} Sys Apps`);
            resolve(combined);
        });
    });

    return promise;
};

var loadSysStoreAppFiles = () => {
    var promise = new Promise((resolve, reject) => {
        var combined = {};
        var totalApps = 0;

        Promise.all([ 
            FileLoader.parseCsvFile("./audit-files/sys-store-app-r1.csv"), 
            FileLoader.parseCsvFile("./audit-files/sys-store-app-r2.csv"),
            FileLoader.parseCsvFile("./audit-files/sys-store-app-r3.csv"),
            FileLoader.parseCsvFile("./audit-files/sys-store-app-r4.csv")
    
        ]).then((dataSets) => {
            dataSets.forEach((dataSet) => { 
                dataSet.forEach((row) => {
                    if(row.data && row.data.customApps && row.data.customApps.apps) {
                        if(combined[row.instanceName] == undefined)
                            combined[row.instanceName] = {};

                        for(var id in row.data.customApps.apps) {
                            var app = row.data.customApps.apps[id];

                            combined[row.instanceName][id] = {
                                createdOn: app.c,
                                installedOn: app.i,
                                isSysApp: false,
                                isSysStoreApp: true,
                                isAESApp: false
                            };

                            totalApps++;
                        }
                    }
                })
            });
    
            console.log(`Found ${totalApps} Sys Store Apps`);
            resolve(combined);
        });
    });

    return promise;
};

var loadAllFiles = (instances) => {
    var promise = new Promise((resolve, reject) => {
        var combinedApps = {};

        Promise.all([
            loadAESFiles(),
            loadSysAppFiles(),
            loadSysStoreAppFiles()

        ]).then((dataSets) => {
            dataSets.forEach((dataSet) => { 
                for(var instanceName in dataSet) {
                    var instance = instances[instanceName];

                    if(instance == undefined)
                        continue;

                    var accountNo = instance.accountNo;
                    var isProduction = (instance.purpose == "Production");

                    if(combinedApps[accountNo] == undefined)
                        combinedApps[accountNo] = { instance: instance, apps: {} };

                    for(var id in dataSet[instanceName]) {
                        var app = dataSet[instanceName][id];

                        if(combinedApps[accountNo].apps[id] == undefined)
                            combinedApps[accountNo].apps[id] = { isAESApp: false, isSysApp: false, isSysStoreApp: false, createdOn: "", installedOn: "", isProduction: false };

                        var existingApp = combinedApps[accountNo].apps[id];

                        existingApp.isAESApp = (existingApp.isAESApp || app.isAESApp);
                        existingApp.isSysApp = (existingApp.isSysApp || app.isSysApp);
                        existingApp.isSysStoreApp = (existingApp.isSysStoreApp || app.isSysStoreApp);
                        existingApp.isProduction = (existingApp.isProduction || isProduction);

                        if(existingApp.createdOn.length == 0)
                            existingApp.createdOn = app.createdOn;

                        if(existingApp.installedOn.length == 0)
                            existingApp.installedOn = app.installedOn;
                    }
                }
            });

            fs.writeFile('custom-apps.json', JSON.stringify(combinedApps, null, 2), () => {
                console.log("Logged json to custom-apps.json file");
                resolve(combinedApps);
            });
        });        
	});

	return promise;
};

var writeCustomAppsWorksheet = (workbook, combinedApps) => {
    var worksheet = workbook.addWorksheet("Custom Apps");
    var records = [];

    worksheet.setColumns([
        { header: 'Company', width: 42 },
        { header: 'Account No.', width: 12 },
        { header: 'Account Type', width: 17 },
        //{ header: 'NNACV', width: 17 },
        { header: 'Primary Rep', width: 22 },
        { header: 'Solution Consultant', width: 23 },
        { header: 'App Engine Subscriber', width: 22 },
        { header: 'App ID', width: 22 },
        { header: 'Is AES App', width: 22 },
        { header: 'Is Sys App', width: 22 },
        { header: 'Is Sys Store App', width: 22 },
        { header: 'Is Production Instance', width: 22 },
        { header: 'Is Real App', width: 22 },
        { header: 'Created On', width: 22 },
        { header: 'Created On YYYY-MM', width: 22 },
        { header: 'Created On YYYY', width: 22 },
        { header: 'Installed On', width: 22 },
        { header: 'Installed On YYYY-MM', width: 22 },
        { header: 'Installed On YYYY', width: 22 },
    ]);

    for(var accountNo in combinedApps) {
        var row = combinedApps[accountNo];
        var customer = row.instance.account;

        for(var id in row.apps) {
            var app = row.apps[id];

            var record = {
                company: customer.accountName,
                accountNo: accountNo,
                accountType: customer.accountType,
                //acv: customer.totalACV,
                primaryRep: customer.primarySalesRep,
                solutionConsultant: customer.solutionConsultant,
                isAppEngineSubscriber: customer.isAppEngineSubscriber,
                appId: id,
                isAESApp: app.isAESApp,
                isSysApp: app.isSysApp,
                isSysStoreApp: app.isSysStoreApp,
                isProductionInstance: app.isProduction,
                isRealApp: (app.isSysApp || app.isSysStoreApp),
                createdOn: app.createdOn,
                createdOnYearMonth: moment(app.createdOn).format("YYYY-MM"),
                createdOnYear: moment(app.createdOn).format("YYYY"),
                installedOn: app.installedOn,
                installedOnYearMonth: (app.installedOn.length > 0 ? moment(app.installedOn).format("YYYY-MM") : ""),
                installedOnYear: (app.installedOn.length > 0 ? moment(app.installedOn).format("YYYY") : "")
            };

            worksheet.addRow(record);

            records.push(record);
        }
    }

    return records;
};


var writeAggregates = (workbook) => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "/audit-files/aggregates.csv");

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
                { header: 'Total AES Apps', width: 20 },
                { header: 'Total Custom Apps (sys_app)', width: 20 },
                { header: 'Total Store Apps (sys_store_app)', width: 20 }
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
                { header: 'AES Apps', width: 20 },
                { header: 'Custom Apps (sys_app)', width: 20 },
                { header: 'Store Apps (sys_store_app)', width: 20 }
            ]);

            auditData.forEach((row) => {
                if(row.data && row.data.apps) {
                    var totalApps = { aes: 0, app: 0, sApp: 0 };
                    var customer = row.instance.account;

                    for(var month in row.data.apps) {
                        var appCounts = row.data.apps[month];
                        
                        totalApps.aes += appCounts.aes;
                        totalApps.app += appCounts.app;
                        totalApps.sApp += appCounts.sApp;
                        
                        wsSummaryByMonth.addRow({
                            instanceName: row.instanceName,
                            purpose: row.instance.purpose,
                            company: customer.accountName,
                            accountNo: customer.accountNo,
                            accountType: customer.accountType,                        
                            isAppEngineSubscriber: customer.isAppEngineSubscriber,
                            createdOnYearMonth: moment(month, "M/YYYY").format("YYYY-MM"),
                            createdOnYear: moment(month, "M/YYYY").format("YYYY"),
                            aes: appCounts.aes,
                            customApps: appCounts.app,
                            storeApps: appCounts.sApp
                        });
                    }
                    
                    wsSummary.addRow({
                        instanceName: row.instanceName,
                        purpose: row.instance.purpose,
                        company: customer.accountName,
                        accountNo: customer.accountNo,
                        accountType: customer.accountType,                        
                        isAppEngineSubscriber: customer.isAppEngineSubscriber,
                        aes: totalApps.aes,
                        customApps: totalApps.app,
                        storeApps: totalApps.sApp
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

    FileLoader.loadInstancesAndAccounts()
        .then(loadAllFiles)
        .then((combinedApps) => {

            var workbook = new Audit.AuditWorkbook("./custom-apps.xlsx");

            writeCustomAppsWorksheet(workbook, combinedApps);

            writeAggregates(workbook).then(() => {
                workbook.commit().then(() => console.log("Finished!"));
            });
        });
})();