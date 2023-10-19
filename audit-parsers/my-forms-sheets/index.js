const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const ExcelJS = require('exceljs');
const moment = require("moment");

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "results.csv");   

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            var wb = new Audit.AuditWorkbook("mysheet-myforms-audit-results.xlsx");

            var wsSummary = wb.addWorksheet("Summary");
            var wsSheets = wb.addWorksheet("MySheets - Worksheets");
            var wsForms = wb.addWorksheet("MyForms - Forms");

            wsSummary.setStandardColumns([
                { header: 'MySheets - Installed', width: 25 },
                { header: 'MySheets - Installed On', width: 25 },
                { header: 'MySheets - Version', width: 25 },
                { header: 'MySheets - Total Workspaces', width: 25 },
                { header: 'MySheets - Total Books', width: 25 },
                { header: 'MySheets - Total Sheets', width: 25 },
                { header: 'MyForms - Installed', width: 25 },
                { header: 'MyForms - Installed On', width: 25 },
                { header: 'MyForms - Version', width: 25 },
                { header: 'MyForms - Total Forms', width: 25 },
                { header: 'MyForms - Total Responses', width: 25 }
            ]);

            wsSheets.setStandardColumns([
                { header: 'Created On', width: 25 },
                { header: 'Created On YYYY-MM', width: 25 },
                { header: 'No. of Columns', width: 25 },
                { header: 'No. of Rows', width: 25 }
            ]);

            wsForms.setStandardColumns([
                { header: 'Created On', width: 25 },
                { header: 'Created On YYYY-MM', width: 25 },
                { header: 'State', width: 25 },
                { header: 'No. of Responses', width: 25 }
            ]);
            
            auditData.forEach((row) => {
                if(row.data && row.data.mySheets && row.data.myForms) { 
                    var record = {
                        sheetsInstalled: false,
                        sheetsInstalledOn: "",
                        sheetsVersion: "",
                        sheetsTotalWorkspaces: 0,
                        sheetsTotalBooks: 0,
                        sheetsTotalSheets: 0,
                        formsInstalled: false,
                        formsInstalledOn: "",
                        formsVersion: "",
                        formsTotalForms: 0,
                        formsTotalResponses: 0
                    };

                    if(row.data.mySheets.appInfo) {
                        var appInfo = row.data.mySheets.appInfo;

                        record.sheetsInstalled = appInfo.installed;
                        record.sheetsInstalledOn = appInfo.installedOn;
                        record.sheetsVersion = appInfo.version;
                    }

                    if(row.data.mySheets.workspaces) {
                        row.data.mySheets.workspaces.forEach((w) => {
                            record.sheetsTotalWorkspaces++;

                            w.books.forEach((b) => {
                                record.sheetsTotalBooks++;

                                b.sheets.forEach((s) => {
                                    record.sheetsTotalSheets++;

                                    wsSheets.addStandardRow(row.instanceName, row.instance, {
                                        createdOn: s.createdOn,
                                        createdOnYYYMM: moment(s.createdOn).format("YYYY-MM"),
                                        columns: s.columns,
                                        rows: s.rows
                                    });
                                });
                            });
                        });
                    }

                    if(row.data.myForms.appInfo) {
                        var appInfo = row.data.myForms.appInfo;

                        record.formsInstalled = appInfo.installed;
                        record.formsInstalledOn = appInfo.installedOn;
                        record.formsVersion = appInfo.version;
                    }

                    if(row.data.myForms.forms) {
                        record.formsTotalForms += row.data.myForms.forms.length;

                        row.data.myForms.forms.forEach((f) => {
                            record.formsTotalResponses += f.responses;

                            wsForms.addStandardRow(row.instanceName, row.instance, {
                                createdOn: f.createdOn,
                                createdOnYYYMM: moment(f.createdOn).format("YYYY-MM"),
                                state: f.state,
                                responses: f.responses
                            });
                        });
                    }

                    if(record.formsInstalled || record.sheetsInstalled)
                        wsSummary.addStandardRow(row.instanceName, row.instance, record);
                }
            });
            
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