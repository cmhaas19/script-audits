
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharedData = require('../shared/shared');
const ExcelJS = require('exceljs');
const moment = require("moment");

var PERMISSION_SETS = {
    0: "All Metadata",
    1: "Upgrade App",
    2: "Manage Update Set",
    3: "Process Automation Designer",
    4: "Script Edit",
    5: "Integrations",
    6: "Submit for Deployment",
    7: "Reporting",
    8: "Security Management",
    9: "Publish To Update Set",
    10: "Delete Application",
    11: "Publish To App Repo",
    12: "Decision Tables",
    13: "Manage Collaborators",
    14: "Mobile Builders",
    15: "UI Builder",
    16: "Workflow",
    17: "Source Control",
    18: "Invite Collaborators",
    19: "Service Catalog",
    20: "Service Portal",
    21: "Flow Designer",
    22: "Publish To App Store",
    23: "Tables & Forms"
};

var generateColumns = (values) => {
    var columns = [
        { header: 'Instance Name', width: 22 },
        { header: 'Company', width: 42 },
        { header: 'Account No.', width: 12 },
        { header: 'Account Type', width: 17 },
        { header: 'Primary Rep', width: 22 },
        { header: 'Solution Consultant', width: 23 },
        { header: 'App Engine Subscriber', width: 22 },
        { header: 'Instance Version', width: 22 },
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

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "delegated-dev-results.xlsx"
        });

        var fileName = path.join(__dirname, "results.csv");       

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            //
            // Scope/User/Permission
            //
            (function(){
                var ws = wb.addWorksheet("Scope-User-Permissions");
    
                ws.columns = generateColumns([
                    { header: 'Scope', width: 20 },
                    { header: 'User', width: 20 },
                    { header: 'Permission', width: 20 }
                ]);
                
                auditData.forEach((row) => {
                    if(row.data && row.data.delegatedDeveloperStats) {

                        for(var scopeId in row.data.delegatedDeveloperStats) {
                            var scope = row.data.delegatedDeveloperStats[scopeId];

                            for(var userId in scope) {
                                var user = scope[userId];
                                var guid = uuidv4();

                                for(var permissionId in user) {
                                    ws.addRow(generateRowValues(row.instanceName, row.instance, [
                                        scopeId,
                                        guid,
                                        PERMISSION_SETS[permissionId]
                                    ])).commit();
                                }
                            }
                        }
                    }
                });

                ws.commit();
                console.log("Processed Scope-User-Permissions");

            })();

            //
            // Permission combinations
            //
            (function(){
                var ws = wb.addWorksheet("Permission Combinations");
    
                ws.columns = [
                    { header: 'Permissions', width: 20 },
                    { header: '# of Users', width: 20 },
                    { header: '# of Apps', width: 20 },
                    { header: '# of Customers', width: 20 }
                ];

                var combinations = {};
                
                auditData.forEach((row) => {
                    if(row.data && row.data.delegatedDeveloperStats) {
                        var accountNo = "";

                        if(row.instance && row.instance.account && row.instance.account.accountNo && row.instance.account.accountNo.length)
                            accountNo = row.instance.account.accountNo;

                        for(var scopeId in row.data.delegatedDeveloperStats) {
                            var scope = row.data.delegatedDeveloperStats[scopeId];

                            for(var userId in scope) {
                                var user = scope[userId];
                                var combination = [];

                                for(var permissionId in user) {
                                    combination.push(PERMISSION_SETS[permissionId]);
                                }

                                combination.sort();

                                if(combinations[combination] == undefined)
                                    combinations[combination] = { scopes: {}, accounts: {}, users: 0 };

                                combinations[combination].scopes[scopeId] = true;
                                combinations[combination].accounts[accountNo] = true;
                                combinations[combination].users++;
                            }
                        }
                    }
                });

                for(var combo in combinations) {
                    ws.addRow([
                        combo,
                        combinations[combo].users,
                        Object.keys(combinations[combo].scopes).length,
                        Object.keys(combinations[combo].accounts).length
                    ]).commit();
                }

                ws.commit();
                console.log("Processed Combinations");
                
            })();

            wb.commit().then(() => {
                console.log("Processed Delegated Dev Permissions");
                resolve();
            });
        });
    });

    return promise;
};


(function(){

    process();

})();