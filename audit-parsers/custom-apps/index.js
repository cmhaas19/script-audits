
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

var loadCustomApps = () => {
    var promise = new Promise((resolve, reject) => {
        var combined = {};
        var ids = {};
        var totalApps = { custom: 0, store: 0, aes: 0 };

        var fileName = path.join(__dirname, "results.json"); 

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((dataSet) => {
            dataSet.forEach((row) => {
                if(row.data && row.data.apps) {
                    for(var className in row.data.apps) {
                        for(var id in row.data.apps[className]) {
                            var app = row.data.apps[className][id];
                            var createdOn = (app.c == undefined ? "1900-01-01" : app.c);
                            var updatedOn = (app.u == undefined ? createdOn : app.u);

                            var customApp = {
                                instance: row.instance,
                                createdOn: createdOn,
                                createdOnYYYYMM: moment(createdOn, 'YYYY-MM-DD').format("YYYY-MM"),
                                updatedOn: updatedOn,
                                updatedOnYYYYMM: moment(updatedOn, 'YYYY-MM-DD').format("YYYY-MM"),
                                daysIdle: moment().diff(updatedOn, 'days'),
                                inactiveSinceCreation: (createdOn == updatedOn),
                                scope: app.s,
                                scopePrefix: "",
                                ide: (app.i != undefined ? app.i : ""),
                                prefix: "",
                                vendorPrefix: "",
                                scopeMatchesPrefix: true,
                                isSysApp: (className == "sys_app"),
                                isSysStoreApp: (className == "sys_store_app"),
                                isAESApp: false,
                                isProduction: (row.instance.purpose == "Production"),
                                isGlobal: (app.s == "global"),
                                isPDI: false
                            };

                            if(row.data.code != undefined && row.data.code.length > 0)
                                customApp.vendorPrefix = `x_${row.data.code}_`;

                            if(customApp.scope.length > 0 && customApp.scope.indexOf("_") != -1)
                                customApp.prefix = customApp.scope.substring(0, customApp.scope.indexOf("_"));

                            if(customApp.scope.length > 0 && customApp.scope.toLowerCase() != "global")
                                customApp.scopeMatchesPrefix = customApp.scope.startsWith(customApp.vendorPrefix);

                            if(customApp.scope.length > 0 && customApp.scope.startsWith("x_"))
                                customApp.scopePrefix = customApp.scope.substring(0, customApp.scope.indexOf("_", 2)) + "_";

                            //if(customApp.ide.length == 0 && aesAppIds[id] != undefined)
                            //    customApp.ide = "AES*";                                  

                            if(customApp.ide == "AES")
                                customApp.isAESApp = true;

                            if(customApp.scope.startsWith("x_")) {                                    
                                var index = customApp.scope.indexOf("_", 2);
                                var vendorCodeFromScope = customApp.scope.substring(2, index);

                                if(vendorCodeFromScope.length > 0 && !customApp.scopeMatchesPrefix) {
                                    customApp.isPDI = !isNaN(vendorCodeFromScope);

                                    /* if(customApp.isPDI)
                                        console.log(`Instance with code ${row.data.code} on customer instance ${row.instanceName}, customer ${row.instance.account.accountName} has an app with a prefix of ${parsedVendorCode}`);
                                    */
                                }
                            }

                            if(combined[row.instanceName] == undefined) {
                                combined[row.instanceName] = {};
                            }
                            combined[row.instanceName][id] = customApp;

                            ids[id] = true;

                            totalApps.custom += (customApp.isSysApp ? 1 : 0);
                            totalApps.store += (customApp.isSysStoreApp ? 1 : 0);
                            totalApps.aes += (customApp.isAESApp ? 1 : 0);
                        }
                    }
                }
            });
    
            console.log(`Found ${totalApps.custom} Sys Apps (${totalApps.aes} are AES apps), ${totalApps.store} Store Apps, ${totalApps.custom + totalApps.store} Total Apps`);
            resolve({ combined, ids });
        });
    });

    return promise;
};

var writeCustomAppsWorksheets = (wb, customApps) => {
    var distinctApps = {};

    (function(){
        var ws = wb.addWorksheet("Custom Apps");

        ws.setStandardColumns([
            { header: 'App ID', width: 22 },
            { header: 'Scope Prefix', width: 22 },
            { header: 'Vendor Prefix', width: 22 },
            { header: 'Scope Vendor Prefix', width: 22 },
            { header: 'Scope', width: 22 },
            { header: 'Scope Matches Vendor Prefix', width: 22 },
            { header: 'Is Global', width: 22 },
            { header: 'Is PDI', width: 22 },
            { header: 'IDE Created', width: 22 },
            { header: 'Is AES App', width: 22 },
            { header: 'Is Sys App', width: 22 },
            { header: 'Is Sys Store App', width: 22 },
            { header: 'Days Idle', width: 22 },
            { header: 'Inactive Since Creation', width: 26 },
            { header: 'Created On', width: 22 },
            { header: 'Created On YYYY-MM', width: 22 },
            { header: 'Created On YYYY', width: 22 },
            { header: 'Created On QTR', width: 22 },
            { header: 'Updated On', width: 22 },
            { header: 'Updated On YYYY-MM', width: 22 },
            { header: 'Updated On YYYY', width: 22 },
            { header: 'Updated On QTR', width: 22 }
        ]);

        for(var instanceName in customApps) {
            var apps = customApps[instanceName];
    
            for(var id in apps) {
                var app = {
                    account: apps[id].instance.account,
                    id: id,
                    instanceCount: 0,
                    accounts: { },
                    createdOn: apps[id].createdOn,
                    createdOnYearMonth: moment(apps[id].createdOn).format("YYYY-DD"),
                    createdOnYear: moment(apps[id].createdOn).format("YYYY"),
                    createdOnQtr: `${moment(apps[id].createdOn, "YYYY-MM").format("YYYY")}-Q${moment(apps[id].createdOn, "YYYY-MM").quarter()}`,
                    updatedOn: apps[id].updatedOn,
                    updatedOnYearMonth: moment(apps[id].updatedOn).format("YYYY-DD"),
                    updatedOnYear: moment(apps[id].updatedOn).format("YYYY"),
                    updatedOnQtr: `${moment(apps[id].updatedOn, "YYYY-MM").format("YYYY")}-Q${moment(apps[id].updatedOn, "YYYY-MM").quarter()}`,
                    prefix: apps[id].prefix,
                    prefix: apps[id].prefix,
                    vendorPrefix: apps[id].vendorPrefix,
                    scopePrefix: apps[id].scopePrefix,
                    scopeMatchesPrefix: apps[id].scopeMatchesPrefix,
                    isGlobal: apps[id].isGlobal,
                    ide: apps[id].ide,
                    scope: apps[id].scope,
                    isSysApp: apps[id].isSysApp,
                    isSysStoreApp: apps[id].isSysStoreApp,
                    isAESApp: apps[id].isAESApp,
                    isProduction: apps[id].isProduction,
                    isPDI: apps[id].isPDI,
                    daysIdle: apps[id].daysIdle,
                    inactiveSinceCreation: apps[id].inactiveSinceCreation
                };

                ws.addStandardRow(instanceName, apps[id].instance, {
                    id,
                    prefix: app.prefix,
                    vendorPrefix: app.vendorPrefix,
                    scopePrefix: app.scopePrefix,
                    scope: app.scope,
                    scopeMatchesPrefix: app.scopeMatchesPrefix,
                    isGlobal: app.isGlobal,
                    isPDI: app.isPDI,
                    ide: app.ide,
                    isAESApp: app.isAESApp,
                    isSysApp: app.isSysApp,
                    isSysStoreApp: app.isSysStoreApp,
                    daysIdle: app.daysIdle,
                    inactiveSinceCreation: app.inactiveSinceCreation,
                    createdOn: app.createdOn,
                    createdOnYearMonth: app.createdOnYearMonth,
                    createdOnYear: app.createdOnYear,
                    createdOnQtr: app.createdOnQtr,
                    updatedOn: app.updatedOn,
                    updatedOnYearMonth: app.updatedOnYearMonth,
                    updatedOnYear: app.updatedOnYear,
                    updatedOnQtr: app.updatedOnQtr
                });
    
                if(distinctApps[id] == undefined)
                    distinctApps[id] = app;
                
                var existingApp = distinctApps[id];
    
                //
                // Update any fields based on this record
                //
                existingApp.instanceCount++;
                existingApp.accounts[app.account.accountNo] = true;
                existingApp.isSysApp = (existingApp.isSysApp || app.isSysApp);
                existingApp.isSysStoreApp = (existingApp.isSysStoreApp || app.isSysStoreApp);
                existingApp.isAESApp = (existingApp.isAESApp || app.isAESApp);
                existingApp.isProduction = (existingApp.isProduction || app.isProduction);
                existingApp.isGlobal = (existingApp.isGlobal || app.isGlobal);
            }
        }

    })();

    //
    // Now write the de-duped data set
    //
    (function(){
        var ws = wb.addWorksheet("Custom Apps - Distinct");

        ws.setColumns([
            { header: 'Company', width: 42 },
            { header: 'Account No.', width: 12 },
            { header: 'Account Type', width: 17 },
            { header: 'Primary Rep', width: 22 },
            { header: 'Solution Consultant', width: 23 },
            { header: 'App Engine Subscriber', width: 22 },
            { header: 'App ID', width: 22 },
            { header: 'Scope Prefix', width: 22 },
            { header: 'Vendor Prefix', width: 22 },
            { header: 'Scope Vendor Prefix', width: 22 },
            { header: 'Scope', width: 22 },
            { header: 'Scope Matches Vendor Prefix', width: 22 },
            { header: 'Is Global', width: 22 },
            { header: 'Is PDI', width: 22 },
            { header: 'No. of Instances', width: 22 },
            { header: 'No. of Accounts', width: 22 },
            { header: 'IDE Created', width: 22 },
            { header: 'Is AES App', width: 22 },
            { header: 'Is Sys App', width: 22 },
            { header: 'Is Sys Store App', width: 22 },
            { header: 'Is Production Instance', width: 22 },
            { header: 'Days Idle', width: 22 },
            { header: 'Inactive Since Creation', width: 26 },
            { header: 'Created On', width: 22 },
            { header: 'Created On YYYY-MM', width: 22 },
            { header: 'Created On YYYY', width: 22 },
            { header: 'Created On QTR', width: 22 },
            { header: 'Updated On', width: 22 },
            { header: 'Updated On YYYY-MM', width: 22 },
            { header: 'Updated On YYYY', width: 22 },
            { header: 'Updated On QTR', width: 22 }
        ]);
        
        for(var id in distinctApps) {
            var app = distinctApps[id];
            
            ws.addRow({
                company: app.account.accountName,
                accountNo: app.account.accountNo,
                accountType: app.account.accountType,
                rep: app.account.primarySalesRep,
                sc: app.account.solutionConsultant,                        
                isAppEngineSubscriber: app.account.isAppEngineSubscriber,
                id,
                prefix: app.prefix,
                vendorPrefix: app.vendorPrefix,
                scopePrefix: app.scopePrefix,
                scope: app.scope,
                scopeMatchesPrefix: app.scopeMatchesPrefix,
                isGlobal: app.isGlobal,
                isPDI: app.isPDI,
                instanceCount: app.instanceCount,
                accountCount: Object.keys(app.accounts).length,
                ide: app.ide,
                isAESApp: app.isAESApp,
                isSysApp: app.isSysApp,
                isSysStoreApp: app.isSysStoreApp,
                isProductionInstance: app.isProduction,
                daysIdle: app.daysIdle,
                inactiveSinceCreation: app.inactiveSinceCreation,
                createdOn: app.createdOn,
                createdOnYearMonth: app.createdOnYearMonth,
                createdOnYear: app.createdOnYear,
                createdOnQtr: app.createdOnQtr,
                updatedOn: app.updatedOn,
                updatedOnYearMonth: app.updatedOnYearMonth,
                updatedOnYear: app.updatedOnYear,
                updatedOnQtr: app.updatedOnQtr
            });
        }
    })();
};

(function(){

    loadCustomApps().then((customApps) => {
        var wb = new Audit.AuditWorkbook("./custom-apps.xlsx");

        /* 
            Write the AES apps to a worksheet. De-dup but count the # of accounts and # of instances where the sys id was found

            Write the custom apps to a worksheet
                Set IDE created to AES if found in the aesApps dataset
                Compare the scope to the vendor prefix, flag if it doesn't match
                De-dup but count the # of accounts and # of instances where it was found. 
                    Bonus if we can count the number of prod instances where it was found.
                    Would love to know how many of the same app are found across different accounts. These are probably partner apps and it will be good

            Write the counts to a separate worksheet
                Instance X has y AES apps, z custom apps, k store apps
                Account X has y unique AES apps, z unique custom apps, k unique store apps

        */

        writeCustomAppsWorksheets(wb, customApps.combined);

        //writeAESWorksheet(wb, instances, aesApps.combined, customApps.ids);
        //writeAESWorksheets(wb, instances, aesApps.combined, customApps.ids);                

        wb.commit().then(() => console.log("Finished!"));

    });
})();