const path = require('path');
const Audit = require('../../common/AuditWorkbook.js');
const FileLoader = require('../../common/FileLoader.js');
const ExcelJS = require('exceljs');
const moment = require("moment");

(function(){
    
    var fileName = path.join(__dirname, "results.json");   
    var rows = 0;
    var tables = 0;

    FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

        var wb = new Audit.AuditWorkbook("custom-table-usage.xlsx");
        var ws = wb.addWorksheet("Custom Table Usage");

        ws.setColumns([
            { header: 'Instance Name', width: 25 },
            { header: 'Account No', width: 25 },
            { header: 'Table Name', width: 25 },
            { header: 'Year', width: 25 },
            { header: 'Inserts', width: 25 },
            { header: 'Updates', width: 25 },
            { header: 'Deletes', width: 25 }
        ]);

        auditData.forEach((row) => {
            if(row.data) {

                var usageByYear = {};

                //
                // Aggregate the data by year instead of MM-YYYY
                // 
                for(var tableName in row.data) {
                    var tableData = row.data[tableName];

                    for(var date in tableData) {
                        var year = date.split("-")[0];

                        if(usageByYear[tableName] == undefined) {
                            usageByYear[tableName] = {};
                        }
    
                        if(usageByYear[tableName][year] == undefined) {
                            usageByYear[tableName][year] = { i: 0, u: 0, d: 0 };
                        }
    
                        usageByYear[tableName][year].i += parseInt(tableData[date].i);
                        usageByYear[tableName][year].u += parseInt(tableData[date].u);
                        usageByYear[tableName][year].d += parseInt(tableData[date].d);

                    }

                    tables++;
                }

                //
                // Now write the data to the worksheet
                //
                for(var tableName in usageByYear) {
                    for(var year in usageByYear[tableName]) {
                        var data = usageByYear[tableName][year];

                        ws.addRow({
                            instanceName: row.instanceName,
                            accountNo: (row.instance && row.instance.account) ? row.instance.account.accountNo : "",
                            tableName: tableName,
                            year: parseInt(year),
                            inserts: data.i,
                            updates: data.u,
                            deletes: data.d
                        });

                        rows++;
                    }   
                }
            }
        });
        
        wb.commit().then(() => {
            console.log("Processed " + rows + " rows and " + tables + " tables");
        });

    });

})();