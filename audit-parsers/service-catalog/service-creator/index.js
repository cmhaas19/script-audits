const path = require('path');
const Audit = require('../../common/AuditWorkbook.js');
const FileLoader = require('../../common/FileLoader.js');
const ExcelJS = require('exceljs');
const moment = require("moment");

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "audit-results.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wb = new Audit.AuditWorkbook("service-creator-usage.xlsx");

            //
            // Services by month
            //
            (function(){
                var ws = wb.addWorksheet("Services By Month");

                ws.setStandardColumns([
                    { header: 'Created Month', width: 25 },
                    { header: 'Count', width: 25 }
                ]);
                
                auditData.forEach((row) => {

                    if(row.data && row.data.services && Object.keys(row.data.services).length > 0) {

                        for(var month in row.data.services) { 
                            var result = {
                                month: moment(month, 'MM/YYYY').format("YYYY-MM"),
                                countOfServices: row.data.services[month]
                            };

                            ws.addStandardRow(row.instanceName, row.instance, result);
                        }
                    }
                });
            })();

            //
            // Service Creator Usage
            //
            (function(){
                var ws = wb.addWorksheet("Service Creator Usage");

                ws.setStandardColumns([
                    { header: 'Month', width: 25 },
                    { header: 'Users', width: 25 }
                ]);
                
                auditData.forEach((row) => {

                    if(row.data && row.data.usage && Object.keys(row.data.usage).length > 0) {

                        for(var month in row.data.usage) { 
                            var result = {
                                month: month,
                                countOfServices: parseInt(row.data.usage[month])
                            };

                            ws.addStandardRow(row.instanceName, row.instance, result);
                        }
                    }
                });

            })();

            //
            // Service Creator Workflow
            //
            (function(){
                var ws = wb.addWorksheet("Service Creator Worklfows");
                var approvalKeys = {};

                ws.setStandardColumns([
                    { header: 'Total Services', width: 25 },
                    { header: 'Total with Workflow', width: 25 },
                    { header: 'Approval Notificatins - Items', width: 25 },
                    { header: 'Approval Notificatins - Total', width: 25 },
                    { header: 'Assignments - User', width: 25 },
                    { header: 'Assignments - Group', width: 25 },
                    { header: 'Completion Notificatins - Items', width: 25 },
                    { header: 'Completion Notificatins - Total', width: 25 },
                    { header: 'Submission Notificatins - Items', width: 25 },
                    { header: 'Submission Notificatins - Total', width: 25 },
                ]);
                
                auditData.forEach((row) => {

                    if(row.data && row.data.workflows && row.data.workflows.workflowDetails) {

                        var result = {
                            totalServices: row.data.workflows.totalItems,
                            totalServicesWithWorkflow: row.data.workflows.totalWithWorkflow,
                            approvalItems: row.data.workflows.workflowDetails.approvalNotifications.items,
                            approvalTotal: row.data.workflows.workflowDetails.approvalNotifications.total,
                            assignmentsUser: row.data.workflows.workflowDetails.assignments.user,
                            assignmentsGroup: row.data.workflows.workflowDetails.assignments.group,
                            completitionItems: row.data.workflows.workflowDetails.completionNotifications.items,
                            completitionTotal: row.data.workflows.workflowDetails.completionNotifications.total,
                            submissionItems: row.data.workflows.workflowDetails.submissionNotifications.items,
                            submissionTotal: row.data.workflows.workflowDetails.submissionNotifications.total
                        };
                        
                        ws.addStandardRow(row.instanceName, row.instance, result);

                        var approvals = row.data.workflows.workflowDetails.approvals;
                        for(var approval in approvals) {
                            if(approvalKeys[approval] == undefined) {
                                approvalKeys[approval] = 0;
                            }
                            approvalKeys[approval]++;
                        }                        
                    }
                });

                console.log(approvalKeys);

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