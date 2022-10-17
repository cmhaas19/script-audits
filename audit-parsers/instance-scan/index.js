
const path = require('path');
const sharedData = require('../shared/shared');
const ExcelJS = require('exceljs');
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

var processInstanceScanChecks = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "instance-scan-results.xlsx"
        });

        var fileName = path.join(__dirname, "results.csv");   

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            (function(){
                var ws = wb.addWorksheet("General");

                var columns = [
                    { header: 'Instance Scan Troubleshooter Installed', width: 17 },
                    { header: 'Instance Security Center Installed', width: 25 },
                    { header: 'Example Checks Installed', width: 25 },
                    { header: '# of scans on scoped apps', width: 25 }
                ];

                //
                // Determine types & categories
                //
                var categories = {},
                    types = {};

                auditData.forEach((row) => {
                    if(row.data && row.data.aggregates) {
                        var aggregates = row.data.aggregates;

                        if(aggregates.checksByType) {
                            for(var key in aggregates.checksByType) {
                                if(types[key] == undefined)
                                    types[key] = [];
                            }
                        }

                        if(aggregates.checksByCategory) {
                            for(var key in aggregates.checksByCategory) {
                                if(categories[key] == undefined)
                                    categories[key] = [];
                            }
                        }
                    }
                });

                Object.keys(categories).forEach((key) => {
                    columns.push({ header: "Category - " + key, width: 15});
                });

                Object.keys(types).forEach((key) => {
                    columns.push({ header: "Scan Type - " + key, width: 15});
                });
    
                ws.columns = generateColumns(columns);
                
                auditData.forEach((row) => {

                    if(row.data && row.data.installationStatus && row.data.aggregates) {
                        var values = [];

                        values.push(
                            row.data.installationStatus.sn_troubleshooter,
                            row.data.installationStatus.sn_isc_core,
                            row.data.installationStatus.x_appe_exa_checks,
                            row.data.aggregates.scopeScanCount);

                        Object.keys(categories).forEach((key) => {
                            if(row.data.aggregates.checksByCategory && row.data.aggregates.checksByCategory[key])
                                values.push(row.data.aggregates.checksByCategory[key])
                            else
                                values.push(0);
                        });
                        
                        Object.keys(types).forEach((key) => {
                            if(row.data.aggregates.checksByType && row.data.aggregates.checksByType[key])
                                values.push(row.data.aggregates.checksByType[key])
                            else
                                values.push(0);
                        });

                        ws.addRow(generateRowValues(row.instanceName, row.instance, values)).commit();
                    }
                });

                ws.commit();

            })();

            (function(){
                var ws = wb.addWorksheet("Check Details");
    
                ws.columns = generateColumns([
                    { header: 'Name', width: 17 },
                    { header: 'Category', width: 25 },
                    { header: 'Check Type', width: 25 },
                    { header: 'Package', width: 25 }
                ]);
                
                auditData.forEach((row) => {
                    if(row.data && row.data.details) {
                        row.data.details.forEach((check) => {
                            ws.addRow(generateRowValues(row.instanceName, row.instance, [
                                check.nm,
                                check.cat,
                                check.classNm,
                                check.pkg
                            ])).commit();
                        });
                    }
                });

                ws.commit();

            })();
            
            wb.commit().then(() => {
                console.log("Completed instance scan checks");
                resolve();
            });

        });

    });

    return promise;
};

(function(){

    processInstanceScanChecks()
        .then(() => { console.log("Done") });

})();