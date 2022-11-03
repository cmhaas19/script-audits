
const path = require('path');
const FileLoader = require('../common/FileLoader.js');
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

var processSummary = (wb, auditData) => {
    var ws = wb.addWorksheet("Summary");

    ws.columns = generateColumns([
        { header: 'Company Code', width: 20 },
        { header: 'Table Name', width: 20 },
        { header: 'Parent Table', width: 20 },
        { header: 'Root Table', width: 20 },
        { header: 'Full Path', width: 20 }
    ]);
    ws.autoFilter = { from: 'A1', to: 'V1' };

    auditData.forEach((row) => {
        if(row.data && row.data.customTables) {
            var customTables = row.data.customTables;

            for(var tableName in customTables) {
                var table = customTables[tableName];
                var values = [];

                values.push(row.data.companyCode);
                values.push(tableName);

                if(table.path && table.path.length) {
                    
                    // Parent Table
                    values.push(table.path[0]);

                    // Root Table
                    values.push(table.path[table.path.length - 1]);

                    // Full Path
                    values.push(table.path.join(" > "));

                } else {
                    values.push("", "", "");
                }

                ws.addRow(generateRowValues(row.instanceName, row.instance, values)).commit();
            }
        }
    });

    ws.commit();
};

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "custom-table-audit.xlsx"
        });

        var fileName = path.join(__dirname, "results.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            processSummary(wb, auditData);
            
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