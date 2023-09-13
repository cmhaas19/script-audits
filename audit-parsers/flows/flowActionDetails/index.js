const path = require('path');
const Audit = require('../../common/AuditWorkbook.js');
const FileLoader = require('../../common/FileLoader.js');
const ExcelJS = require('exceljs');
const moment = require("moment");

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "audit-results.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wb = new Audit.AuditWorkbook("flow-action-details-results.xlsx");

            //
            // Update Record Action
            //
            (function(){
                var wsTables = wb.addWorksheet("Update Record - Tables");
                var wsFields = wb.addWorksheet("Update Record - Fields");

                wsTables.setStandardColumns([
                    { header: 'Table', width: 25 },
                    { header: 'Table Count', width: 25 }
                ]);

                wsFields.setStandardColumns([
                    { header: 'Fields', width: 25 },
                    { header: 'Fields Count', width: 25 }
                ]);

                auditData.forEach((row) => {
                    if(row.data && row.data.actions && row.data.actions["Update Record"]) {     
                        var updateAction = row.data.actions["Update Record"];

                        if(updateAction.Table) {
                            for(var tableName in updateAction.Table) {
                                wsTables.addStandardRow(row.instanceName, row.instance, {
                                    tableName,
                                    count: updateAction.Table[tableName]
                                });
                            }
                        }

                        if(updateAction.Fields) {
                            for(var fieldName in updateAction.Fields) {
                                wsFields.addStandardRow(row.instanceName, row.instance, {
                                    fieldName,
                                    count: updateAction.Fields[fieldName]
                                });
                            }
                        }
                    }
                });

            })();

            //
            // Wait for Condition Action
            //
            (function(){
                var wsTables = wb.addWorksheet("Wait for - Tables");
                var wsFields = wb.addWorksheet("Wait for - Conditions");

                wsTables.setStandardColumns([
                    { header: 'Table', width: 25 },
                    { header: 'Table Count', width: 25 }
                ]);

                wsFields.setStandardColumns([
                    { header: 'Fields', width: 25 },
                    { header: 'Fields Count', width: 25 }
                ]);

                auditData.forEach((row) => {
                    if(row.data && row.data.actions && row.data.actions["Wait For Condition"]) {     
                        var action = row.data.actions["Wait For Condition"];

                        if(action.Table) {
                            for(var tableName in action.Table) {
                                wsTables.addStandardRow(row.instanceName, row.instance, {
                                    tableName,
                                    count: action.Table[tableName]
                                });
                            }
                        }

                        if(action.Conditions) {
                            for(var fieldName in action.Conditions) {
                                wsFields.addStandardRow(row.instanceName, row.instance, {
                                    fieldName,
                                    count: action.Conditions[fieldName]
                                });
                            }
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