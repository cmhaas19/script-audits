const path = require('path');
const Audit = require('../../common/AuditWorkbook.js');
const FileLoader = require('../../common/FileLoader.js');
const ExcelJS = require('exceljs');
const moment = require("moment");

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "results.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wb = new Audit.AuditWorkbook("catalog-features-results.xlsx");

            //
            // Items by month
            //
            (function(){
                var ws = wb.addWorksheet("Catalog Features");

                ws.setStandardColumns([
                    { header: 'Created Year', width: 25 },
                    { header: 'Catalog Items - Total', width: 25 },
                    { header: 'Catalog Items - With UI Policies', width: 25 },
                    { header: 'Catalog Items - With Question Sets', width: 25 },
                    { header: 'Catalog Items - With Auto Populate', width: 25 },
                    { header: 'Catalog Items - With Topics', width: 25 },
                    { header: 'Record Producers - Total', width: 25 },
                    { header: 'Record Producers - With UI Policies', width: 25 },
                    { header: 'Record Producers - With Question Sets', width: 25 },
                    { header: 'Record Producers - With Auto Populate', width: 25 },
                    { header: 'Record Producers - With Topics', width: 25 }                    
                ]);
                
                auditData.forEach((row) => {
                    if(row.data && row.data.catalogItems) {        

                        for(var year in row.data.catalogItems) {
                            var catalogItems = row.data.catalogItems[year].catalogItems;
                            var recordProducers = row.data.catalogItems[year].recordProducers;

                            var result = {
                                year: moment(year, 'YYYY/YYYY').format("YYYY"),
                                cit: catalogItems.total,
                                citu: catalogItems.uiPolicyTotal,
                                citqs: catalogItems.questionSetTotal,
                                citsap: catalogItems.autoPopulateTotal,
                                cistst: catalogItems.topicAssignmentTotal,
                                rpt: recordProducers.total,
                                rptu: recordProducers.uiPolicyTotal,
                                rptqs: recordProducers.questionSetTotal,
                                rptsap: recordProducers.autoPopulateTotal,
                                rpstst: recordProducers.topicAssignmentTotal
                            };

                            ws.addStandardRow(row.instanceName, row.instance, result);

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