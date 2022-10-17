
const path = require('path');
const sharedData = require('../shared/shared');
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

var processRecordProducers = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "record-producer-results.xlsx"
        });

        var fileName = path.join(__dirname, "record-producers.csv");   

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            (function(){
                var ws = wb.addWorksheet("General");
    
                ws.columns = generateColumns([
                    { header: '# of Record Producers', width: 17 },
                    { header: '# Map to Custom Global Tables', width: 25 },
                    { header: '# Map to Custom Scoped Tables', width: 25 },
                    { header: '# Map to Custom Tables', width: 25 },
                    { header: '# with questions only mapped to fields', width: 32 },
                    { header: '# with questions only mapped to variables', width: 32 },
                    { header: '# with questions mapped to fields and variables', width: 35 },
                    { header: '# of questions mapped to fields', width: 27 },
                    { header: '# of questions mapped to variables', width: 27 },
                    { header: '# of questions mapped to variables and fields', width: 34 }
                ]);
                
                auditData.forEach((row) => {

                    if(row.data) {
                        var values = [];

                        if(row.data.counts) {
                            values.push(row.data.counts.total, row.data.counts.customTableGlobal, row.data.counts.customTableScoped, (row.data.counts.customTableGlobal + row.data.counts.customTableScoped));
                        } else {
                            values.push(0, 0, 0);
                        }

                        if(row.data.questionMapMix) {
                            values.push(row.data.questionMapMix.total, row.data.questionMapMix.pureFields, row.data.questionMapMix.pureVariables, row.data.questionMapMix.mixture);
                        } else {
                            values.push(0, 0, 0, 0);
                        }

                        if(row.data.questionMapsToFields) {
                            values.push((row.data.questionMapsToFields.true || 0), (row.data.questionMapsToFields.false || 0));
                        } else {
                            values.push(0, 0);
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

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

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

    processRecordProducers()
        .then(() => processServices()
        .then(() => { console.log("Done") }));

})();