
const path = require('path');
const sharedData = require('../../shared/shared');
const ExcelJS = require('exceljs');
const moment = require("moment");

var TRIGGER_TYPES = {
	"1": "Created",
	"2": "Created or Updated",
	"3": "Daily",
	"4": "Inbound Email",
	"5": "Monthly",
	"6": "Repeat",
	"7": "Run Once",
	"8": "Service Catalog",
	"9": "SLA Task",
	"10": "Trigger Rest",
	"11": "Updated",
	"12": "Weekly"
};

var generateColumns = (values) => {
    var columns = [
        { header: 'Instance Name', width: 22 },
        { header: 'Company', width: 16 },
        { header: 'Account No.', width: 13 },
        { header: 'Instance Version', width: 22 },
        { header: 'Instance Purpose', width: 16 },
    ];

    return columns.concat(values);
};

var generateRowValues = (instanceName, instance, values) => {
    var rowValues = [];

    if(instance)
        rowValues = [instanceName, instance.customer, instance.accountNo, instance.version, instance.purpose];
    else
        rowValues = [instanceName,"","","",""];

    return rowValues.concat(values);
};

var processFlowTriggers = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "flow-trigger-results.xlsx"
        });

        var fileName = path.join(__dirname, "flows.csv");       

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var generalWs = wb.addWorksheet("General");
    
            generalWs.columns = generateColumns([
                { header: 'Company Code', width: 20 },
                { header: 'Active', width: 20 },
                { header: 'Trigger Type', width: 20 },
                { header: 'Flow Scope', width: 20 },
                { header: 'Table', width: 30 },
                { header: 'Table Scope', width: 30 },
                { header: 'Same Scope', width: 18 }
            ]);
            
            auditData.forEach((row) => {

                if(row.instance && row.instance.purpose == "Production" && row.data && row.data.flows && row.data.flows.length > 0) {

                    row.data.flows.forEach((flow) => {
                        var tableName = "",
                            tableScope = "",
                            triggerType = "",
                            scopeMatches = false;

                        if(flow.trigger) {
                            triggerType = flow.trigger.type.toString();

                            if(TRIGGER_TYPES[triggerType] != undefined)
                                triggerType = TRIGGER_TYPES[triggerType];

                            if(flow.trigger.table) {
                                tableName = flow.trigger.table.name;
                                tableScope = flow.trigger.table.scope;

                                if(flow.scope == tableScope) {
                                    scopeMatches = true;
                                }
                            }
                        }

                        generalWs.addRow(
                            generateRowValues(row.instanceName, row.instance, [
                                row.data.companyCode, 
                                flow.active,
                                triggerType,
                                flow.scope,
                                tableName,
                                tableScope,
                                scopeMatches])).commit();
                    });
                }
            });

            generalWs.commit();
            
            wb.commit().then(() => {
                resolve();
            });
        });
    });

    return promise;
};


(function(){

    processFlowTriggers()
        .then(() => { console.log("Done") });

})();