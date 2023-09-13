const Audit = require('../../common/AuditWorkbook.js');
const FileLoader = require('../../common/FileLoader.js');
const moment = require('moment');
const fs = require('fs');

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

var loadFiles = (instances) => {
    var promise = new Promise((resolve, reject) => {
        var combined = {};
        var totalFlows = 0;
        var missingFlows = {};
        var flowIds = {};

        Promise.all([ 
            FileLoader.parseCsvFile("./files/flows-r1.csv"), 
            FileLoader.parseCsvFile("./files/flows-r2.csv"),
            FileLoader.parseCsvFile("./files/flows-r3.csv"),
            FileLoader.parseCsvFile("./files/flows-r4.csv")
    
        ]).then((dataSets) => {
            //
            // Combine all the flows
            //
            dataSets.forEach((dataSet) => { 
                dataSet.forEach((row) => {
                    if(row.data && row.data.flows) {
                        var instance = instances[row.instanceName];

                        if(instance != undefined && instance.purpose == "Production") {

                            if(combined[row.instanceName] == undefined)
                                combined[row.instanceName] = {};

                            if(row.data.totalFlows > 300) {
                                if(missingFlows[row.instanceName] == undefined) {
                                    missingFlows[row.instanceName] = (row.data.totalFlows - 300);
                                }
                            }
                            
                            for(var id in row.data.flows) {
                                var flow = row.data.flows[id];

                                if(flowIds[id] != undefined)
                                    continue;

                                flowIds[id] = true;

                                if(combined[row.instanceName][id] == undefined || instance.purpose == "Production"){
                                    combined[row.instanceName][id] = flow;
                                    totalFlows++;
                                }
                            }
                        }
                    }
                });
            });

            //
            // Report out the missing flows
            //
            var missingFlowsTotal = 0;
            for(var instanceName in missingFlows) {
                missingFlowsTotal += missingFlows[instanceName];
            }
    
            console.log(`Found ${totalFlows} Flows. Did not record ${missingFlowsTotal} flows across ${Object.keys(missingFlows).length} instances`);
            
            resolve(combined);
        });
    });

    return promise;
};

var writeDetails = (workbook, instances, combinedFlows) => {
    var wsDetails = workbook.addWorksheet("Flow Details");
    var wsLogic = workbook.addWorksheet("Flow Logic");
    var wsActions = workbook.addWorksheet("Flow Actions");

    wsDetails.setColumns([
        { header: 'Instance', width: 20 },
        { header: 'Instance Purpose', width: 20 },
        { header: 'Company', width: 42 },
        { header: 'Account No.', width: 12 },
        { header: 'Account Type', width: 17 },
        { header: 'Flow ID', width: 22 },
        { header: 'Flow Name', width: 22 },
        { header: 'Trigger Type', width: 22 },
        { header: 'Trigger Table Name', width: 22 },
        { header: 'Trigger Table Path', width: 22 },
        { header: 'Total Logic Block Types', width: 22 },
        { header: 'Total Action Types', width: 22 },
        { header: 'Total Subflows', width: 22 }
    ]);

    wsLogic.setColumns([
        { header: 'Instance', width: 20 },
        { header: 'Instance Purpose', width: 20 },
        { header: 'Company', width: 42 },
        { header: 'Account No.', width: 12 },
        { header: 'Account Type', width: 17 },
        { header: 'Flow ID', width: 22 },
        { header: 'Flow Name', width: 22 },
        { header: 'Trigger Type', width: 22 },
        { header: 'Trigger Table Name', width: 22 },
        { header: 'Trigger Table Path', width: 22 },
        { header: 'Logic Block', width: 22 },
        { header: 'Logic Block Count', width: 22 }
    ]);

    wsActions.setColumns([
        { header: 'Instance', width: 20 },
        { header: 'Instance Purpose', width: 20 },
        { header: 'Company', width: 42 },
        { header: 'Account No.', width: 12 },
        { header: 'Account Type', width: 17 },
        { header: 'Flow ID', width: 22 },
        { header: 'Flow Name', width: 22 },
        { header: 'Trigger Type', width: 22 },
        { header: 'Trigger Table Name', width: 22 },
        { header: 'Trigger Table Path', width: 22 },
        { header: 'Action Name', width: 22 },
        { header: 'Action Count', width: 22 }
    ]);

    for(var instanceName in combinedFlows) {
        var instance = instances[instanceName];
        var flows = combinedFlows[instanceName];

        for(var id in flows) {
            var flow = flows[id];

            var detailRecord = {
                instance: instanceName,
                purpose: instance.purpose,
                company: instance.account.accountName,
                accountNo: instance.account.accountNo,
                accountType: instance.account.accountType,
                flowId: id,
                flowName: flow.name,
                triggerType: "Unknown",
                tableName: "",
                tablePath: "",
                totalLogicBlocks: 0,
                totalActions: 0,
                totalSubflows: 0
            };

            if(flow.trigger != undefined) {
                detailRecord.triggerType = TRIGGER_TYPES[flow.trigger.type];

                if(flow.trigger.table != undefined) {
                    detailRecord.tableName = flow.trigger.table.name;

                    if(Array.isArray(flow.trigger.table.path))
                        detailRecord.tablePath = flow.trigger.table.path[0];
                }
            }

            if(flow.subflows != undefined) {
                detailRecord.totalSubflows = flow.subflows;
            }

            if(flow.logic != undefined) {
                detailRecord.totalLogicBlocks = Object.keys(flow.logic).length;

                for(var logic in flow.logic) {
                    var logicRecord = {
                        instance: detailRecord.instance,
                        purpose: detailRecord.purpose,
                        company: detailRecord.company,
                        accountNo: detailRecord.accountNo,
                        accountType: detailRecord.accountType,
                        flowId: detailRecord.flowId,
                        flowName: detailRecord.flowName,
                        triggerType: detailRecord.triggerType,
                        tableName: detailRecord.tableName,
                        tablePath: detailRecord.tablePath,
                        logic,
                        count: flow.logic[logic]
                    };

                    wsLogic.addRow(logicRecord);
                }
            }

            if(flow.actions != undefined) {
                detailRecord.totalActions = Object.keys(flow.actions).length;

                for(var action in flow.actions) {
                    var actionRecord = {
                        instance: detailRecord.instance,
                        purpose: detailRecord.purpose,
                        company: detailRecord.company,
                        accountNo: detailRecord.accountNo,
                        accountType: detailRecord.accountType,
                        flowId: detailRecord.flowId,
                        flowName: detailRecord.flowName,
                        triggerType: detailRecord.triggerType,
                        tableName: detailRecord.tableName,
                        tablePath: detailRecord.tablePath,
                        action,
                        count: flow.actions[action]
                    };

                    wsActions.addRow(actionRecord);
                }
            }

            wsDetails.addRow(detailRecord);
        }
    }
};

var writeActionGroups = (workbook, combinedFlows) => {
    var ws = workbook.addWorksheet("Action Groups");
    var actionGroups = {};
    var triggerTotals = {};

    ws.setColumns([
        { header: 'Trigger', width: 20 },
        { header: 'Action Group', width: 20 },
        { header: 'No. of Flows', width: 20 },
        { header: '% of Flows with Trigger', width: 26 }
    ]);

    for(var instanceName in combinedFlows) {
        var flows = combinedFlows[instanceName];

        for(var id in flows) {
            var flow = flows[id];
            var triggerType = (flow.trigger != undefined ? TRIGGER_TYPES[flow.trigger.type] : "Unknown");

            if(triggerTotals[triggerType] == undefined)
                triggerTotals[triggerType] = 0;
            triggerTotals[triggerType]++;

            if(flow.actions != undefined) {
                if(actionGroups[triggerType] == undefined){
                    actionGroups[triggerType] = {};
                }

                var actions = Object.keys(flow.actions).sort().join(",");

                if(actionGroups[triggerType][actions] == undefined)
                    actionGroups[triggerType][actions] = 0;

                actionGroups[triggerType][actions]++;
            }

            
        }
    }

    for(var triggerType in actionGroups) {
        var totalFlowsWithTrigger = triggerTotals[triggerType];

        for(var action in actionGroups[triggerType]) {
            var totalFlowsWithAction = actionGroups[triggerType][action];

            ws.addRow({
                triggerType,
                action,
                actionGroup: totalFlowsWithAction,
                percent: (totalFlowsWithAction / totalFlowsWithTrigger)
            });
        }
    }
};

(function(){

    FileLoader.loadInstancesAndAccounts().then((instances) => {
        loadFiles(instances).then((combinedFlows) => {
            var workbook = new Audit.AuditWorkbook("./flow-detail-results.xlsx");

            writeDetails(workbook, instances, combinedFlows);

            writeActionGroups(workbook, combinedFlows);

            workbook.commit().then(() => console.log("Finished!"));

        });
    });

})();