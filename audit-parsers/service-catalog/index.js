
const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const ExcelJS = require('exceljs');
const moment = require("moment");

var processRecordProducers = () => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "record-producer-results.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wb = new Audit.AuditWorkbook("record-producer-results.xlsx");

            (function(){
                var ws = wb.addWorksheet("General");

                ws.setStandardColumns([
                    //{ header: '# of Record Producers', width: 17 },
                    { header: '# Map to Custom Global Tables', width: 25 },
                    { header: '# Map to Custom Scoped Tables', width: 25 },
                    { header: '# Map to Custom Tables', width: 25 },
                    { header: '# with questions only mapped to fields', width: 32 },
                    { header: '# with questions only mapped to variables', width: 32 },
                    { header: '# with questions mapped to fields and variables', width: 35 },
                    //{ header: '# of questions mapped to fields', width: 27 },
                    //{ header: '# of questions mapped to variables', width: 27 },
                    //{ header: '# of questions mapped to variables and fields', width: 34 }
                ]);
                
                auditData.forEach((row) => {

                    if(row.data) {

                        var result = {
                            //total: 0,
                            totalGlobalTables: 0,
                            totalScopedTables: 0,
                            totalCustomTables: 0,
                            onlyFields: 0,
                            onlyVariables: 0,
                            mixedFieldsAndVariables: 0,
                            //questionsFields: 0,
                            //questionsVariables: 0,
                            //questionsMixed: 0
                        };

                        if(row.data.counts) {
                            ///result.total = row.data.counts.total;
                            result.totalGlobalTables = row.data.counts.customTableGlobal;
                            result.totalScopedTables = row.data.counts.customTableScoped;
                            result.totalCustomTables = (row.data.counts.customTableGlobal + row.data.counts.customTableScoped);                            
                        }

                        if(row.data.questionMapMix) {
                            result.onlyFields = row.data.questionMapMix.pureFields;
                            result.onlyVariables = row.data.questionMapMix.pureVariables;
                            result.mixedFieldsAndVariables = row.data.questionMapMix.mixture;
                        }

                        /* if(row.data.questionMapsToFields) {
                            if(row.data.questionMapsToFields.true != undefined)
                                result.questionsFields = row.data.questionMapsToFields.true;

                            if(row.data.questionMapsToFields.false != undefined)
                                result.questionsVariables = row.data.questionMapsToFields.false;

                        } */
                        
                        ws.addStandardRow(row.instanceName, row.instance, result);
                    }
                });
            })();

            (function(){
                var ws = wb.addWorksheet("Question Types");
    
                ws.setStandardColumns([
                    { header: 'Question Type', width: 22 },
                    { header: 'Count', width: 16 }
                ]);
                
                auditData.forEach((row) => {
                    if(row.data && row.data.questionTypes) {                        
                        for(var questionType in row.data.questionTypes) {
                            ws.addStandardRow(row.instanceName, row.instance, { questionType, count: row.data.questionTypes[questionType] });
                        }
                    }
                });

            })();

            (function(){
                var ws = wb.addWorksheet("Extended Tables");
    
                ws.setStandardColumns([
                    { header: 'Table', width: 22 },
                    { header: 'Count', width: 16 }
                ]);
                
                auditData.forEach((row) => {
                    if(row.data && row.data.customTables) {                        
                        for(var table in row.data.customTables) {
                            var count = row.data.customTables[table];

                            if(count > 0)
                                ws.addStandardRow(row.instanceName, row.instance, {table, count});
                        }                        
                    }
                });

            })();

            (function(){
                var ws = wb.addWorksheet("Categories");
    
                ws.setStandardColumns([
                    { header: 'No. of items', width: 20 },
                    { header: 'No. of categories mapped', width: 20 }
                ]);
                
                auditData.forEach((row) => {
                    if(row.data && row.data.byCategory) {                        
                        for(var categoryCount in row.data.byCategory) {
                            var itemCount = row.data.byCategory[categoryCount];

                            ws.addStandardRow(row.instanceName, row.instance, {itemCount, categoryCount});
                        }                        
                    }
                });

            })();

            (function(){
                var ws = wb.addWorksheet("Record Producers by Month");
    
                ws.setStandardColumns([
                    { header: 'Month', width: 20 },
                    { header: 'No. of Record Producers', width: 20 }
                ]);
                
                auditData.forEach((row) => {
                    if(row.data && row.data.byMonth) {                        
                        for(var month in row.data.byMonth) {
                            var count = row.data.byMonth[month];

                            if(count > 0)
                                ws.addStandardRow(row.instanceName, row.instance, {month: moment(month, 'MM/YYYY').format("YYYY-MM"), count});
                        }                        
                    }
                });

            })();
            
            wb.commit().then(() => {
                console.log("Completed record producers");
                resolve();
            });

        });

    });

    return promise;
};

var processServices = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "services-results.xlsx"
        });

        var fileName = path.join(__dirname, "services.csv");

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            (function(){
                var ws = wb.addWorksheet("General");
    
                ws.columns = generateColumns([
                    { header: '# of Services', width: 17 },
                    { header: '# of Services Mapped to Custom Global Tables', width: 25 },
                    { header: '# of Services Mapped to Custom Scoped Tables', width: 25 },
                    { header: '# of Service Items', width: 17 },
                    { header: '# of Service Items Mapped to Custom Global Tables', width: 25 },
                    { header: '# of Service Items Mapped to Custom Scoped Tables', width: 25 }
                ]);
                
                auditData.forEach((row) => {

                    if(row.data) {
                        var values = [];

                        if(row.data.counts && row.data.counts.services) {
                            values.push(row.data.counts.services.total, row.data.counts.services.customTableGlobal, row.data.counts.services.customTableScoped)
                        } else {
                            values.push(0, 0, 0);
                        }

                        if(row.data.counts && row.data.counts.serviceItems) {
                            values.push(row.data.counts.serviceItems.total, row.data.counts.serviceItems.customTableGlobal, row.data.counts.serviceItems.customTableScoped)
                        } else {
                            values.push(0, 0, 0);
                        }                      

                        ws.addRow(generateRowValues(row.instanceName, row.instance, values)).commit();
                    }
                });

                ws.commit();

            })();

            (function(){
                var ws = wb.addWorksheet("Question Types");
    
                ws.columns = generateColumns([
                    { header: 'Question Type', width: 22 },
                    { header: 'Count', width: 16 }
                ]);
                
                auditData.forEach((row) => {
                    if(row.data && row.data.questionTypes) {                        
                        for(var questionType in row.data.questionTypes) {
                            ws.addRow(generateRowValues(row.instanceName, row.instance, [questionType, row.data.questionTypes[questionType]])).commit();
                        }                        
                    }
                });

                ws.commit();

            })();

            (function(){
                var ws = wb.addWorksheet("Extended Tables");
    
                ws.columns = generateColumns([
                    { header: 'Table', width: 22 },
                    { header: 'Count', width: 16 }
                ]);
                
                auditData.forEach((row) => {
                    if(row.data && row.data.customTables) {                        
                        for(var table in row.data.customTables) {
                            var count = row.data.customTables[table];

                            if(count > 0)
                                ws.addRow(generateRowValues(row.instanceName, row.instance, [table, count])).commit();
                        }                        
                    }
                });

                ws.commit();

            })();
            
            wb.commit().then(() => {
                console.log("Completed services");
                resolve();
            });

        });

    });

    return promise;
};

(function(){

    /* processRecordProducers()
        .then(() => processServices()
        .then(() => { console.log("Done") })); */
    
    processRecordProducers()
        .then(() => { console.log("Done") });

})();