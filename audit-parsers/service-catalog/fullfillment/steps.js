
const path = require('path');
const Audit = require('../../common/AuditWorkbook.js');
const FileLoader = require('../../common/FileLoader.js');
const ExcelJS = require('exceljs');

var STEP_NAMES = {};

var OOTB_STEPS = {
    "dc0f364873122010ae42d31ee2f6a7f3": "Task",
    "2b7d9a7e87022010c84e4561d5cb0b21": "Custom Approval",
    "38ee146053162010fca7ddeeff7b1221": "Manager Approval"
};

var getStepNames = (auditData) => {

    auditData.forEach((row) => {
        if(row.data && row.data.fulfillmentSteps && row.data.currentLanguage == "en") {
            for(var stepId in row.data.fulfillmentSteps) {
                if(row.data.fulfillmentSteps[stepId].name && row.data.fulfillmentSteps[stepId].name.length > 0 && STEP_NAMES[stepId] == undefined)
                    STEP_NAMES[stepId] = row.data.fulfillmentSteps[stepId].name;
            }
        }
    });
};

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "fulfillment-steps-audit.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wb = new Audit.AuditWorkbook("fulfillment-steps.xlsx");

            getStepNames(auditData);

            (function(){
                var ws = wb.addWorksheet("Fulfillment Steps");

                ws.setStandardColumns([
                    { header: 'Step SysID', width: 25 },
                    { header: 'Step Name', width: 25 },
                    { header: 'Item Count', width: 32 },
                    { header: 'Step Count', width: 25 },
                    { header: 'Is Custom Step', width: 15 },
                ]);
                
                auditData.forEach((row) => {
                    if(row.data && row.data.fulfillmentSteps) {

                        for(var id in row.data.fulfillmentSteps) {
                            var step = row.data.fulfillmentSteps[id];

                            ws.addStandardRow(row.instanceName, row.instance, {
                                id: id,
                                name: (STEP_NAMES[id] || step.name),
                                itemCount: step.items,
                                stepCount: step.total,
                                isCustom: (OOTB_STEPS[id] == undefined)
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
