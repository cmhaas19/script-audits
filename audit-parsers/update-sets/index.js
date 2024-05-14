const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require("moment");

(function(){

    var fileName = path.join(__dirname, "results.csv");       

    FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

        var wb = new Audit.AuditWorkbook("update-sets-audit.xlsx");

        var ws = wb.addWorksheet("Completed By Month");

        ws.setStandardColumns([
            { header: 'Month', width: 20 },
            { header: 'Year', width: 20 },
            { header: 'Total', width: 20, alignment: { horizontal: 'right' } }
        ]);

        auditData.forEach((row) => {

            if(row.instance.purpose == 'Production') {
                if(row.data) {
                    for(var month in row.data) {
                        ws.addStandardRow(row.instanceName, row.instance, {
                            month: moment(month, 'MM/YYYY').format("YYYY-MM"),
                            year: moment(month, 'MM/YYYY').format("YYYY"),
                            count: row.data[month]
                        });
                    }
                }
            }
        });

        wb.commit().then(() => console.log("Finished!"));

    });

})();