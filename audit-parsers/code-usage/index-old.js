const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const ExcelJS = require('exceljs');
const moment = require("moment");

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "results-old-script-2023.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wb = new Audit.AuditWorkbook("old-code-usage-results.xlsx");

            //
            // Code usage summary
            //
            var wsErrors = wb.addWorksheet('Errors');

            wsErrors.setStandardColumns([
                { header: 'Error Description', width: 42 }
            ]);

            auditData.forEach((row) => {
                if(!row.success) {
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