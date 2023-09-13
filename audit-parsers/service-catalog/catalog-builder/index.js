const path = require('path');
const Audit = require('../../common/AuditWorkbook.js');
const FileLoader = require('../../common/FileLoader.js');
const ExcelJS = require('exceljs');
const moment = require("moment");

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "audit-results.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wb = new Audit.AuditWorkbook("catalog-builder-results.xlsx");

            //
            // Items by month
            //
            (function(){
                var ws = wb.addWorksheet("Items By Year");

                ws.setStandardColumns([
                    { header: 'Created Year', width: 25 },
                    { header: 'Catalog Items - Total', width: 25 },
                    { header: 'Catalog Items - Builder', width: 25 },
                    { header: 'Record Producers - Total', width: 25 },
                    { header: 'Record Producers - Builder', width: 25 }
                ]);
                
                auditData.forEach((row) => {
                    if(row.data && row.data.catalogItems) {        
                        var years = {};                

                        for(var month in row.data.catalogItems) { 
                            var year = moment(month, 'MM/YYYY').format("YYYY");

                            if(years[year] == undefined)
                                years[year] = { totalItems: 0, totalBuilerItems: 0, totalRPs: 0, totalBuilerRPs: 0, instanceName: row.instanceName, instance: row.instance };

                            years[year].totalItems += row.data.catalogItems[month].catalogItems.total;
                            years[year].totalBuilerItems += row.data.catalogItems[month].catalogItems.builder;
                            years[year].totalRPs += row.data.catalogItems[month].recordProducers.total;
                            years[year].totalBuilerRPs += row.data.catalogItems[month].recordProducers.builder;
                        }

                        for(var year in years) {
                            var result = {
                                year: year,
                                totalItems: years[year].totalItems,
                                totalBuilerItems: years[year].totalBuilerItems,
                                totalRPs: years[year].totalRPs,
                                totalBuilerRPs: years[year].totalBuilerRPs
                            };

                            ws.addStandardRow(years[year].instanceName, years[year].instance, result);
                        }
                    }
                });
            })();

            //
            // Fulfillment
            //
            (function(){
                var ws = wb.addWorksheet("Items by Fulfillment Usage");

                ws.setStandardColumns([
                    { header: 'Total Items', width: 25 },
                    { header: 'Total Items With Fulfillment Steps', width: 25 }
                ]);
                
                auditData.forEach((row) => {

                    if(row.data && row.data.fulfillmentUsage) {
                        var result = {
                            totalItems: row.data.fulfillmentUsage.totalItems,
                            totalItemsWithFulfillmentSteps: row.data.fulfillmentUsage.totalItemsWithFulfillmentSteps
                        };

                        ws.addStandardRow(row.instanceName, row.instance, result);
                    }
                });

            })();

            //
            // Fulfillment Steps
            //
            (function(){
                var ws = wb.addWorksheet("Fulfillment Steps");

                ws.setStandardColumns([
                    { header: 'Step ID', width: 25 },
                    { header: 'Step Name', width: 25 },
                    { header: 'No. of Items', width: 25 },
                    { header: 'Total Steps', width: 25 }
                ]);
                
                auditData.forEach((row) => {

                    if(row.data && row.data.fulfillmentSteps) {
                        for(var stepId in row.data.fulfillmentSteps) {
                            var step = row.data.fulfillmentSteps[stepId];

                            var result = {
                                id: stepId,
                                name: step.name,
                                items: step.items,
                                totalSteps: step.total
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