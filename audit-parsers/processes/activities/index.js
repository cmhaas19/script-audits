
const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const ExcelJS = require('exceljs');

var ACTIVITY_NAMES = {};

var getActivityNames = (auditData) => {

    auditData.forEach((row) => {
        if(row.data && row.data.activities && row.data.currentLanguage == "en") {
            for(var activityId in row.data.activities) {
                if(row.data.activities[activityId].nm && row.data.activities[activityId].nm.length > 0 && ACTIVITY_NAMES[activityId] == undefined)
                    ACTIVITY_NAMES[activityId] = row.data.activities[activityId].nm;
            }
        }
    });
};

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "results.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wb = new Audit.AuditWorkbook("process-activities.xlsx");

            getActivityNames(auditData);

            (function(){
                var ws = wb.addWorksheet("Activities");

                ws.setStandardColumns([
                    { header: 'Activity SysID', width: 25 },
                    { header: 'Activity Name', width: 25 },
                    { header: 'Process Count', width: 32 },
                    { header: 'Activity Count', width: 25 }
                ]);
                
                auditData.forEach((row) => {
                    if(row.data && row.data.activities) {

                        for(var activityId in row.data.activities) {
                            var activity = row.data.activities[activityId];

                            ws.addStandardRow(row.instanceName, row.instance, {
                                id: activityId,
                                name: (ACTIVITY_NAMES[activityId] || activity.nm),
                                processCount: activity.pc,
                                activityAcount: activity.ac
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