const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const ExcelJS = require('exceljs');
const moment = require("moment");

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "results.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wb = new Audit.AuditWorkbook("code-usage-results.xlsx");

            //
            // Code usage summary
            //
            (function(){
                var ws = wb.addWorksheet("Code Usage");

                ws.setStandardColumns([
                    { header: 'No. of OOTB files modified', width: 25 },
                    { header: 'Records Changed', width: 25 },
                    { header: 'Lines of Code Changed', width: 25 },
                    { header: 'Customer Records Changed', width: 25 },
                    { header: 'Customer Lines of Code Changed', width: 25 }
                ]);

                auditData.forEach((row) => {
                    if(row.data && row.data.all) { 
                        var all = row.data.all;

                        var record = {
                            ootbFilesModified: (all.rc - all.crc),
                            recordsChanged: all.rc,
                            linesOfCodeChanged: all.loc,
                            customerRecordsChanged: all.crc,
                            customerLinesOfCodeChanged: all.cloc
                        };

                        ws.addStandardRow(row.instanceName, row.instance, record); 
                    }
                });
            })();

            //
            // Code usage by table
            //
            (function(){
                var ws = wb.addWorksheet("Code Usage - By Table");

                ws.setStandardColumns([
                    { header: 'Table Name', width: 25 },
                    { header: 'No. of OOTB files modified', width: 25 },
                    { header: 'Records Changed', width: 25 },
                    { header: 'Lines of Code Changed', width: 25 },
                    { header: 'Customer Records Changed', width: 25 },
                    { header: 'Customer Lines of Code Changed', width: 25 }
                ]);

                auditData.forEach((row) => {
                    if(row.data && row.data.byTable) { 
                        for(var tableName in row.data.byTable) {
                            var table = row.data.byTable[tableName];

                            var record = {
                                tableName,
                                ootbFilesModified: (table.rc - table.crc),
                                recordsChanged: table.rc,
                                linesOfCodeChanged: table.loc,
                                customerRecordsChanged: table.crc,
                                customerLinesOfCodeChanged: table.cloc
                            };

                            ws.addStandardRow(row.instanceName, row.instance, record);  
                        }
                    }
                });
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