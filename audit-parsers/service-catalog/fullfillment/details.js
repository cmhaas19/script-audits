
const path = require('path');
const Audit = require('../../common/AuditWorkbook.js');
const FileLoader = require('../../common/FileLoader.js');
const ExcelJS = require('exceljs');

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "fulfillment-step-details-audit.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wb = new Audit.AuditWorkbook("fulfillment-step-details.xlsx");

            (function(){
                var general = wb.addWorksheet("General");
                var customApprovals = wb.addWorksheet("Custom Approvals");
                var managerApprovals = wb.addWorksheet("Manager Approvals");
                var tasks = wb.addWorksheet("Tasks");

                customApprovals.setStandardColumns([
                    { header: 'No. of Users', width: 25 },
                    { header: 'No. of Groups', width: 25 },
                    { header: 'Approval Type', width: 32 },
                    { header: 'Conditions', width: 25 }
                ]);

                managerApprovals.setStandardColumns([
                    { header: 'Conditions', width: 25 }
                ]);

                tasks.setStandardColumns([
                    { header: 'Short Description', width: 25 },
                    { header: 'Description', width: 25 },
                    { header: 'Assignment Group', width: 32 },
                    { header: 'Assigned To', width: 32 },
                    { header: 'Priority', width: 32 },
                    { header: 'Conditions', width: 25 }
                ]);

                general.setStandardColumns([
                    { header: 'Step Type', width: 25 },
                    { header: 'Conditions', width: 25 }
                ]);
                
                auditData.forEach((row) => {
                    if(row.data && row.data.fulfillmentSteps) {

                        if(row.data.fulfillmentSteps.customApprovals) {
                            row.data.fulfillmentSteps.customApprovals.forEach((item, i) => {
                                customApprovals.addStandardRow(row.instanceName, row.instance, {
                                    users: item.users,
                                    groups: item.groups,
                                    type: item.type,
                                    conditions: item.cd
                                });

                                general.addStandardRow(row.instanceName, row.instance, {
                                    stepType: "Custom Approval",
                                    conditions: item.cd
                                });
                            });
                        }

                        if(row.data.fulfillmentSteps.managerApprovals) {
                            row.data.fulfillmentSteps.managerApprovals.forEach((item, i) => {
                                managerApprovals.addStandardRow(row.instanceName, row.instance, {
                                    conditions: item.cd
                                });

                                general.addStandardRow(row.instanceName, row.instance, {
                                    stepType: "Manager Approval",
                                    conditions: item.cd
                                });
                            });                            
                        }

                        if(row.data.fulfillmentSteps.tasks) {
                            row.data.fulfillmentSteps.tasks.forEach((item, i) => {
                                tasks.addStandardRow(row.instanceName, row.instance, {
                                    shortDescription: item.sd,
                                    description: item.d,
                                    assignmentGroup: item.ag,
                                    assignedTo: item.at,
                                    prioirty: item.p,
                                    conditions: item.cd
                                });

                                general.addStandardRow(row.instanceName, row.instance, {
                                    stepType: "Task",
                                    conditions: item.cd
                                });
                            });
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