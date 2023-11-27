const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const ExcelJS = require('exceljs');
const moment = require("moment");

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "results.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wb = new Audit.AuditWorkbook("app-customizations.xlsx");
            var customizations = {};

            var countFiles = (files) => {
                var i = 0;
                for(var fileType in files) {
                    i += files[fileType];
                }
                return i;
            };

            //
            // Write all customizations
            //
            (function(){
                var ws = wb.addWorksheet("Customizations - All");

                ws.setStandardColumns([
                    { header: 'Customization ID', width: 25 },
                    { header: 'App Name', width: 25 },
                    { header: 'App ID', width: 25 },
                    { header: 'App Scope', width: 25 },
                    { header: 'App Version', width: 25 },
                    { header: 'Customization Version', width: 25 },
                    { header: 'No. of File Types', width: 25 },
                    { header: 'Total Files', width: 25 },
                    { header: 'Created On', width: 25 },
                    { header: 'Created On YYYY-MM', width: 25 }
                ]);

                auditData.forEach((row) => {
                    if(row.data && row.data.customizations) { 
                        for(var id in row.data.customizations) {
                            var customization = row.data.customizations[id];

                            var record = {
                                id: id,
                                appName: customization.app.nm,
                                appId: customization.app.id,
                                appScope: customization.app.scope,
                                appVersion: customization.app.version,
                                version: customization.version,
                                fileTypes: Object.keys(customization.files).length,
                                files: countFiles(customization.files),
                                createdOn: customization.createdOn,
                                createdOnYYYYMM: moment(customization.createdOn).format("YYYY-MM")
                            };

                            if(record.version != "none" && record.files > 0)
                                ws.addStandardRow(row.instanceName, row.instance, record);
                        }
                    }
                });
            })();
            
            //
            // De-dup
            //
            auditData.forEach((row) => {
                if(row.data && row.data.customizations) { 
                    for(var id in row.data.customizations) {
                        var customization = row.data.customizations[id];

                        if(customizations[id] == undefined) {
                            customizations[id] = {
                                customization: customization,
                                instances: {},
                                accounts: {},
                                isProduction: false
                            }
                        }

                        customizations[id].accounts[row.instance.account.accountNo] = true;
                        customizations[id].instances[row.instanceName] = true;
                        customizations[id].isProduction = (customizations[id].isProduction || row.instance.purpose == "Production");
                    }
                }
            });

            //
            // Build worksheet
            //
            (function(){
                var ws = wb.addWorksheet("Customizations - Distinct");

                ws.setColumns([
                    { header: 'Customization ID', width: 25 },
                    { header: 'App Name', width: 25 },
                    { header: 'App ID', width: 25 },
                    { header: 'App Scope', width: 25 },
                    { header: 'App Version', width: 25 },
                    { header: 'Customization Version', width: 25 },
                    { header: 'No. of File Types', width: 25 },
                    { header: 'Total Files', width: 25 },
                    { header: 'Created On', width: 25 },
                    { header: 'Created On YYYY-MM', width: 25 },
                    { header: 'No. of Instances', width: 25 },
                    { header: 'No. of Accounts', width: 25 },
                    { header: 'Installed on Production', width: 25 }
                ]);

                for(var id in customizations) {
                    var customization = customizations[id];
                    var record = {
                        id:id,
                        appName: customization.customization.app.nm,
                        appId: customization.customization.app.id,
                        appScope: customization.customization.app.scope,
                        appVersion: customization.customization.app.version,
                        version: customization.customization.version,
                        fileTypes: Object.keys(customization.customization.files).length,
                        files: countFiles(customization.customization.files),
                        createdOn: customization.customization.createdOn,
                        createdOnYYYYMM: moment(customization.customization.createdOn).format("YYYY-MM"),
                        instances: Object.keys(customization.instances).length,
                        accounts: Object.keys(customization.accounts).length,
                        isProd: customization.isProduction
                    };

                    if(record.version != "none" && record.files > 0)
                        ws.addRow(record);
                }
            })();

            (function(){
                var ws = wb.addWorksheet("Customizations - Files");

                ws.setColumns([
                    { header: 'Customization ID', width: 25 },
                    { header: 'App Name', width: 25 },
                    { header: 'App ID', width: 25 },
                    { header: 'App Scope', width: 25 },
                    { header: 'App Version', width: 25 },
                    { header: 'Customization Version', width: 25 },
                    { header: 'File Type', width: 25 },
                    { header: 'No. of files', width: 25 }
                ]);

                for(var id in customizations) {
                    var customization = customizations[id];

                    for(var fileTypeName in customization.customization.files) {

                        var record = {
                            id:id,
                            appName: customization.customization.app.nm,
                            appId: customization.customization.app.id,
                            appScope: customization.customization.app.scope,
                            appVersion: customization.customization.app.version,
                            version: customization.customization.version,
                            fileType: fileTypeName,
                            fileCount: customization.customization.files[fileTypeName]
                        };
    
                        ws.addRow(record);
                    }
                }

            })();
            
            wb.commit().then(() => {
                resolve();
            });

        });

    });

    return promise;
};

(function(){
    
    process()
        .then(() => { console.log("Done") });

})();