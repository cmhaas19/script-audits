
const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require("moment");

var getGuidedSetupStatus = (data, propName) => {
    var status = 0;

    if(data.guidedSetupStatus && data.guidedSetupStatus[propName] && data.guidedSetupStatus[propName].progress) {
        status = parseInt(data.guidedSetupStatus[propName].progress);
    }

    return status;
};

var processSummary = (wb, auditData) => {
    var ws = wb.addWorksheet("Summary");

    ws.setStandardColumns([
        { header: 'AEMC - Installed', width: 20 },
        { header: 'AEMC - Installed On', width: 20 },
        { header: 'AEMC - Version', width: 20 },
        { header: 'AEMC - Guided Setup %', width: 20, alignment: { horizontal: 'right' } },
        { header: 'App Intake - Guided Setup %', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Pipelines - Guided Setup %', width: 20, alignment: { horizontal: 'right' } },
        { header: 'App Intake - Installed', width: 20 },
        { header: 'App Intake - Active', width: 20 },
        { header: 'App Intake Requests - Total', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Deployment Requests - Total', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Collaboration Requests - Total', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Pipelines - Total', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Environments - Total', width: 20, alignment: { horizontal: 'right' } }
    ]);

    auditData.forEach((row) => {
        if(row.data) {

            var result = {
                installed: false,
                installedOn: "",
                version: "",
                aemcGuidedSetup: getGuidedSetupStatus(row.data, "aemcGuidedSetup"),
                appIntakeGuidedSetup: getGuidedSetupStatus(row.data, "appIntakeGuidedSetup"),
                pipelineGuidedSetup: getGuidedSetupStatus(row.data, "pipelineGuidedSetup"),
                appIntakeInstalled: false,
                appIntakeActive: false,
                appIntakeCounts: 0,
                deploymentCounts: 0,
                collaborationRequests: 0,
                pipelineCount: 0,
                environmentCount: 0
            };

            if(row.data.installationStatus && row.data.installationStatus.aemc) {
                var installedOn = row.data.installationStatus.aemc.installedOn;                

                if(installedOn && installedOn.length) {
                    installedOn = moment(installedOn, 'YYYY-MM-DD').format("YYYY-MM");
                }

                result.installed = row.data.installationStatus.aemc.installed;
                result.installedOn = installedOn;
                result.version = row.data.installationStatus.aemc.version;

            }
    
            if(row.data.appIntakeRequests) {
                for(var month in row.data.appIntakeRequests.months) {
                    result.appIntakeCounts += row.data.appIntakeRequests.months[month];
                }

                result.appIntakeInstalled = row.data.appIntakeRequests.installed;
                result.appIntakeInstalled = row.data.appIntakeRequests.active;
            }
    
            if(row.data.deploymentRequests) {
                for(var month in row.data.deploymentRequests) {
                    result.deploymentCounts += row.data.deploymentRequests[month];
                }
            }
    
            if(row.data.collaborationRequests) {
                for(var month in row.data.collaborationRequests) {
                    result.collaborationRequests += row.data.collaborationRequests[month];
                }
            }
    
            if(row.data.pipelineConfigurations) {
                var environments = {};
    
                for(var id in row.data.pipelineConfigurations) {
                    result.pipelineCount++;
    
                    if(row.data.pipelineConfigurations[id].environments) {
                        row.data.pipelineConfigurations[id].environments.forEach((env) => {
                            environments[env.id] = true;
                        });
                    }
                }

                result.environmentCount = Object.keys(environments).length;
            }

            ws.addStandardRow(row.instanceName, row.instance, result);
        }
    });
};

var processTasksByMonth = (wb, auditData) => {
    var ws = wb.addWorksheet("Customers by Month");

    ws.setColumns([
        { header: 'Customer', width: 20 },
        { header: 'Account No.', width: 20 },
        { header: 'Account Type', width: 20 },
        { header: 'Primary Rep', width: 20 },
        { header: 'Solution Consultant', width: 20 },
        { header: 'App Engine Subscriber', width: 22 },
        { header: 'Month', width: 20 },
        { header: 'Monthly Active Users', width: 25, alignment: { horizontal: 'right' } },
        { header: 'Deployment Tasks', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Collaboration Tasks', width: 20, alignment: { horizontal: 'right' } },
        { header: 'App Intake Tasks', width: 20, alignment: { horizontal: 'right' } },
    ]);

    var CUSTOMERS = {};
    var getOrCreateCustomerMonth = (row, month) => {
        var instance = row.instance;
        var account = instance.account;

        if(CUSTOMERS[account.accountNo] == undefined)
            CUSTOMERS[account.accountNo] = {};

        if(CUSTOMERS[account.accountNo][month] == undefined)
            CUSTOMERS[account.accountNo][month] = { deployment: 0, collaboration: 0, intake: 0, activeUsers: 0, instance: instance };

        return CUSTOMERS[account.accountNo][month];
    };

    auditData.forEach((row) => {
        if(row.data && row.instance && row.instance.purpose != "Demonstration") {
    
            if(row.data.appIntakeRequests) {
                for(var month in row.data.appIntakeRequests.months) {
                    getOrCreateCustomerMonth(row, moment(month, 'MM/YYYY').format("YYYY-MM")).intake += row.data.appIntakeRequests.months[month];
                }
            } 
    
            if(row.data.deploymentRequests) {
                for(var month in row.data.deploymentRequests) {
                    getOrCreateCustomerMonth(row, moment(month, 'MM/YYYY').format("YYYY-MM")).deployment += row.data.deploymentRequests[month];
                }
            }
    
            if(row.data.collaborationRequests) {
                for(var month in row.data.collaborationRequests) {
                    getOrCreateCustomerMonth(row, moment(month, 'MM/YYYY').format("YYYY-MM")).collaboration += row.data.collaborationRequests[month];
                }
            }

            if(row.data.applicationUsage && row.data.applicationUsage["App Engine Management Center"]) {
                for(var month in row.data.applicationUsage["App Engine Management Center"]) {
                    getOrCreateCustomerMonth(row, month).activeUsers += parseInt(row.data.applicationUsage["App Engine Management Center"][month]);
                }
            }
        }
    });

    for(var accountNo in CUSTOMERS) {
        for(var month in CUSTOMERS[accountNo]) {
            var instance = CUSTOMERS[accountNo][month].instance;
            var account = instance.account;

            ws.addRow({
                accountName: account.accountName,
                accountNo: account.accountNo,
                accountType: account.accountType,
                primarySalesRep: account.primarySalesRep,
                solutionConsultant: account.solutionConsultant,
                isAppEngineSubscriber: account.isAppEngineSubscriber,
                month: month,
                activeUsers: CUSTOMERS[accountNo][month].activeUsers,
                deploymentCounts: CUSTOMERS[accountNo][month].deployment,
                collaborationCounts: CUSTOMERS[accountNo][month].collaboration,
                intakeCounts: CUSTOMERS[accountNo][month].intake
            });
        }
    }
};

var processCustomers = (wb, auditData) => {
    var ws = wb.addWorksheet("Customers");

    ws.setColumns([
        { header: 'Customer', width: 20 },
        { header: 'Account No.', width: 20 },
        { header: 'Account Type', width: 20 },
        { header: 'Primary Rep', width: 20 },
        { header: 'Solution Consultant', width: 20 },
        { header: 'App Engine Subscriber', width: 22 },
        { header: 'AEMC Installed On', width: 17 },
        { header: 'AEMC Installed On YYYY-MM', width: 12 },
        { header: 'AEMC Version', width: 17 },
    ]);

    var CUSTOMERS = {};

    auditData.forEach((row) => {
        if(row.instance && row.instance.account && row.data && row.data.installationStatus && row.data.installationStatus.aemc) {
            var aemc = row.data.installationStatus.aemc;
            var instance = row.instance;
            var account = instance.account;

            if(aemc.installed === true) {
                if(CUSTOMERS[account.accountNo] == undefined){                    
                    CUSTOMERS[account.accountNo] = true;

                    ws.addRow({
                        accountName: account.accountName,
                        accountNo: account.accountNo,
                        accountType: account.accountType,
                        primarySalesRep: account.primarySalesRep,
                        solutionConsultant: account.solutionConsultant,
                        isAppEngineSubscriber: account.isAppEngineSubscriber,
                        installedOn: aemc.installedOn,
                        installedOnYearMonth: moment(aemc.installedOn, 'YYYY-MM-DD').format("YYYY-MM"),
                        version: aemc.version
                    });
                }
            }
        }
    });
};

var processDeploymentCounts = (wb, auditData) => {
    var ws = wb.addWorksheet("Deployment Requests");

    ws.setStandardColumns([
        { header: 'Month', width: 20 },
        { header: 'Total', width: 20, alignment: { horizontal: 'right' } }
    ]);

    auditData.forEach((row) => {
        if(row.data && row.data.deploymentRequests) {
            for(var month in row.data.deploymentRequests) {
                ws.addStandardRow(row.instanceName, row.instance, {
                    month: moment(month, 'MM/YYYY').format("YYYY-MM"),
                    count: row.data.deploymentRequests[month]
                });
            }
        }
    });
};

var processCollaborationCounts = (wb, auditData) => {
    var ws = wb.addWorksheet("Collaboration Requests");

    ws.setStandardColumns([
        { header: 'Month', width: 20 },
        { header: 'Total', width: 20, alignment: { horizontal: 'right' } }
    ]);

    auditData.forEach((row) => {
        if(row.data && row.data.collaborationRequests) {
            for(var month in row.data.collaborationRequests) {
                ws.addStandardRow(row.instanceName, row.instance, {
                    month: moment(month, 'MM/YYYY').format("YYYY-MM"),
                    count: row.data.collaborationRequests[month]
                });
            }
        }
    });
};

var processIntakeCounts = (wb, auditData) => {
    var ws = wb.addWorksheet("App Intake Requests");

    ws.setStandardColumns([
        { header: 'Month', width: 20 },
        { header: 'Total', width: 20, alignment: { horizontal: 'right' } }
    ]);

    auditData.forEach((row) => {
        if(row.data && row.data.appIntakeRequests && row.data.appIntakeRequests.months) {
            for(var month in row.data.appIntakeRequests.months) {
                ws.addStandardRow(row.instanceName, row.instance, {
                    month: moment(month, 'MM/YYYY').format("YYYY-MM"),
                    count: row.data.appIntakeRequests[month]
                });
            }
        }
    });
};

var processPipelines = (wb, auditData) => {
    var ws = wb.addWorksheet("Pipeline Configurations");

    ws.setStandardColumns([
        { header: 'Pipeline ID', width: 20 },
        { header: 'Pipeline Name', width: 20 },
        { header: 'Pipeline Active', width: 20 },
        { header: 'Pipeline Created On', width: 20 },
        { header: 'Pipeline Type ID', width: 20 },
        { header: 'Pipeline Name', width: 20 },
        { header: 'Source Environment ID', width: 20 },
        { header: 'Source Environment Name', width: 20 },
        { header: 'Total Environments', width: 20, alignment: { horizontal: 'right' } }
    ]);

    auditData.forEach((row) => {
        if(row.data && row.data.pipelineConfigurations) {
            for(var configId in row.data.pipelineConfigurations) {
                var config = row.data.pipelineConfigurations[configId];
                var environments = 0;

                if(row.data.pipelineConfigurations[configId].environments)
                    environments = row.data.pipelineConfigurations[configId].environments.length;

                ws.addStandardRow(row.instanceName, row.instance, {
                    configId: configId,
                    name: config.name, 
                    active: config.active, 
                    createdOn: config.createdOn, 
                    typeId: config.type.id, 
                    typeName: config.type.name, 
                    sourceEnvironmentId: config.sourceEnvironment.id, 
                    sourceEnvironmentName: config.sourceEnvironment.name,
                    environments
                });
            }
        }
    });
};

var processPipelineEnvironments = (wb, auditData) => {
    var ws = wb.addWorksheet("Pipeline Environments");

    ws.setStandardColumns([
        { header: 'Environment ID', width: 20 },
        { header: 'Environment Name', width: 20 },
        { header: 'Instance ID', width: 20 },
        { header: 'Instance URL', width: 20 },
        { header: 'Is Controller', width: 20 },
        { header: 'Order', width: 20, alignment: { horizontal: 'right' } }
    ]);

    auditData.forEach((row) => {
        if(row.data && row.data.pipelineConfigurations) {
            for(var configId in row.data.pipelineConfigurations) {
                var config = row.data.pipelineConfigurations[configId];

                if(config.environments && config.environments.length) {
                    config.environments.forEach(env => {
                        ws.addStandardRow(row.instanceName, row.instance, {                                 
                            id: env.environment.id,
                            name: env.environment.name,
                            instanceId: env.environment.instanceId,
                            instanceUrl: env.environment.instanceUrl,
                            isController: env.environment.isController,
                            order: parseInt(env.order)
                        });
                    });
                }                            
            }
        }
    });
};

(function(){

    var fileName = path.join(__dirname, "settings.csv");       

    FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

        var wb = new Audit.AuditWorkbook("aemc-audit.xlsx");

        processSummary(wb, auditData);

        processCustomers(wb, auditData);

        processTasksByMonth(wb, auditData);

        processDeploymentCounts(wb, auditData);

        processCollaborationCounts(wb, auditData);

        processIntakeCounts(wb, auditData);

        processPipelines(wb, auditData);

        processPipelineEnvironments(wb, auditData);
        
        wb.commit().then(() => console.log("Finished!"));

    });

})();