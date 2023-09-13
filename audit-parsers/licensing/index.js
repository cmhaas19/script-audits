const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require("moment");

(function(){

    var fileName = path.join(__dirname, "results.csv");       

    FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

        var wb = new Audit.AuditWorkbook("licensing-results.xlsx");
        var ws = wb.addWorksheet("Licenses");

        ws.setStandardColumns([
            { header: 'Name', width: 20 },
            { header: 'Start Date', width: 20 },
            { header: 'End Date', width: 20 },
            { header: 'Table Count', width: 20 },
            { header: 'Tables Used', width: 20 },
            { header: 'Product Code', width: 20 },
            { header: 'Allocated', width: 20 },
            { header: 'Allocated Status', width: 20 },
            { header: 'Expired', width: 20 },
            { header: 'Created On', width: 20 }
        ]);

        auditData.forEach((row) => {
            if(row.data && row.data.licenses && row.data.licenses.length) {
                row.data.licenses.forEach((license) => {
                    ws.addStandardRow(row.instanceName, row.instance, license);

                });
            }
        });

        wb.commit().then(() => console.log("Finished!"));

    });

})();