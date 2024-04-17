const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const ExcelJS = require('exceljs');
const moment = require("moment");

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "results.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wb = new Audit.AuditWorkbook("code-usage-results2.xlsx");

            //
            // Code usage summary
            //
            var ws = wb.addWorksheet("Code Usage Summary");
            var wsTable = wb.addWorksheet("Code Usage - By Table");
            var wsFields = wb.addWorksheet("Code Usage - By Field");
            var wsErrors = wb.addWorksheet('Errors');

            wsErrors.setStandardColumns([
                { header: 'Error Description', width: 42 }
            ]);

            ws.setStandardColumns([
                { header: 'Start Date', width: 25 },
                { header: 'End Date', width: 25 },
                { header: 'Total Files Modified', width: 25 },
                { header: 'OOTB Files Modified', width: 25 },
                { header: 'Total Customer Files Modified', width: 25 },
                { header: 'Customer Files Modified - Existing', width: 25 },
                { header: 'Customer Files Modified - New', width: 25 },
                { header: 'Total Lines of Code Changed', width: 25 },
                { header: 'Excluded: Modified Files with unchanged script fields', width: 25 },
                { header: 'Excluded: Modified Files by ServiceNow', width: 25 }
            ]);

            wsTable.setStandardColumns([
                { header: 'Table Name', width: 25 },
                { header: 'Total Files Modified', width: 25 },
                { header: 'OOTB Files Modified', width: 25 },
                { header: 'Total Customer Files Modified', width: 25 },
                { header: 'Customer Files Modified - Existing', width: 25 },
                { header: 'Customer Files Modified - New', width: 25 },
                { header: 'Total Lines of Code Changed', width: 25 },
                { header: 'Excluded: Modified Files with unchanged script fields', width: 25 },
                { header: 'Excluded: Modified Files by ServiceNow', width: 25 }
            ]);

            wsFields.setStandardColumns([
                { header: 'Table Name', width: 25 },
                { header: 'Field Name', width: 25 },
                { header: 'Total Files Modified', width: 25 },
                { header: 'Total OOTB Files Modified', width: 25 },
                { header: 'Total Customer Files Modified', width: 25 },
                { header: 'Total Lines of Code Changed', width: 25 },
                { header: 'Excluded: Modified Files with unchanged script fields', width: 25 },
                { header: 'Excluded: Omitted Records', width: 25 }
            ]);

            auditData.forEach((row) => {
                if(row.data && row.data.summary) { 
                    var log = row.data.log;
                    var summary = row.data.summary;

                    var summaryRecord = {
                        startDate: moment(log.DateRanges.s).format("MM/DD/YYYY"),
                        endDate: moment(log.DateRanges.e).format("MM/DD/YYYY"),
                        totalFilesModified: (summary.o + summary.c),
                        ootbFilesModified: summary.o,
                        customerFilesModified: summary.c,
                        customerFilesModifiedExisting: (summary.c - summary.cc),
                        customerFilesModifiedNew: summary.cc,
                        linesOfCodeChanged: summary.l,
                        unchanged: summary.unc,
                        maint: summary.m
                    };

                    ws.addStandardRow(row.instanceName, row.instance, summaryRecord);

                    if(row.data && row.data.tables) { 
                        for(var tableName in row.data.tables) {
                            var table = row.data.tables[tableName];

                            var tableRecord = {
                                tableName,
                                totalFilesModified: (table.o + table.c),
                                ootbFilesModified: table.o,
                                customerFilesModified: table.c,
                                customerFilesModifiedExisting: (table.c - table.cc),
                                customerFilesModifiedNew: table.cc,
                                linesOfCodeChanged: table.l,
                                unchanged: table.unc,
                                maint: table.m
                            };

                            wsTable.addStandardRow(row.instanceName, row.instance, tableRecord);

                            for(var fieldName in table.f) {
                                var field = table.f[fieldName];

                                var fieldRecord = {
                                    tableName,
                                    fieldName,
                                    totalFilesModified: (field.o + field.c),
                                    ootbFilesModified: field.o,
                                    customerFilesModified: field.c,
                                    linesOfCodeChanged: field.l,
                                    unchanged: field.unc,
                                    omitted: field.om
                                };

                                wsFields.addStandardRow(row.instanceName, row.instance, fieldRecord);
                            }
                        }
                    }
                } else if(!row.success) {
                    wsErrors.addStandardRow(row.instanceName, row.instance, {
                        errorDescription: row.errorDescription
                    });
                }

                
            });
            
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