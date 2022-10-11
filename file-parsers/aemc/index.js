
const path = require('path');
const sharedData = require('../shared/shared');
const ExcelJS = require('exceljs');
const moment = require("moment");

var generateColumns = (values) => {
    var columns = [
        { header: 'Instance Name', width: 22 },
        { header: 'Company', width: 42 },
        { header: 'Account No.', width: 12 },
        { header: 'Account Type', width: 17 },
        { header: 'Primary Rep', width: 22 },
        { header: 'Solution Consultant', width: 23 },
        { header: 'App Engine Subscriber', width: 22 },
        { header: 'Instance Version', width: 63 },
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

var getGuidedSetupStatus = (data, propName) => {
    var status = 0;

    if(data.guidedSetupStatus && data.guidedSetupStatus[propName] && data.guidedSetupStatus[propName].progress) {
        status = parseInt(data.guidedSetupStatus[propName].progress);
    }

    return status;
};

var processSummary = (wb, auditData) => {
    var ws = wb.addWorksheet("Summary");

    ws.columns = generateColumns([
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
    ws.autoFilter = { from: 'A1', to: 'V1' };

    auditData.forEach((row) => {
        if(row.data) {

            var values = [];
            var deploymentCounts = 0,
                collabCounts = 0,
                intakeCounts = 0;

            if(row.data.installationStatus && row.data.installationStatus.aemc) {
                var installedOn = row.data.installationStatus.aemc.installedOn;                

                if(installedOn && installedOn.length) {
                    installedOn = moment(installedOn, 'YYYY-MM-DD').format("YYYY-MM");
                }

                values.push(
                    row.data.installationStatus.aemc.installed, 
                    installedOn,
                    row.data.installationStatus.aemc.version);

            } else {
                values.push("","","");
            }

            values.push(
                getGuidedSetupStatus(row.data, "aemcGuidedSetup"),
                getGuidedSetupStatus(row.data, "appIntakeGuidedSetup"),
                getGuidedSetupStatus(row.data, "pipelineGuidedSetup"));
    
            if(row.data.appIntakeRequests) {
                for(var month in row.data.appIntakeRequests.months) {
                    intakeCounts += row.data.appIntakeRequests.months[month];
                }

                values.push(
                    row.data.appIntakeRequests.installed,
                    row.data.appIntakeRequests.active,
                    intakeCounts);

            } else {
                values.push("","",0);
            }
    
            if(row.data.deploymentRequests) {
                for(var month in row.data.deploymentRequests) {
                    deploymentCounts += row.data.deploymentRequests[month];
                }
            }
    
            if(row.data.collaborationRequests) {
                for(var month in row.data.collaborationRequests) {
                    collabCounts += row.data.collaborationRequests[month];
                }
            }
    
            values.push(deploymentCounts, collabCounts);
    
            if(row.data.pipelineConfigurations) {
                var environments = {};
                var pipelines = 0;
    
                for(var id in row.data.pipelineConfigurations) {
                    pipelines++;
    
                    if(row.data.pipelineConfigurations[id].environments) {
                        row.data.pipelineConfigurations[id].environments.forEach((env) => {
                            environments[env.id] = true;
                        });
                    }
                }

                values.push(pipelines, Object.keys(environments).length);

            } else {
                values.push(0,0);
            }

            ws.addRow(generateRowValues(row.instanceName, row.instance, values)).commit();
        }
    });

    ws.commit();
};

var processTasksByMonth = (wb, auditData) => {
    var ws = wb.addWorksheet("Tasks by Month");

    ws.columns = [
        { header: 'Month', width: 20 },
        { header: 'Deployment Tasks', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Collaboration Tasks', width: 20, alignment: { horizontal: 'right' } },
        { header: 'App Intake Tasks', width: 20, alignment: { horizontal: 'right' } }
    ];

    var TASKS = {};
    var getOrCreateMonth = (month) => {
        if(TASKS[month] == undefined)
            TASKS[month] = { deployment: 0, collaboration: 0, intake: 0 };

        return TASKS[month];
    }

    auditData.forEach((row) => {
        if(row.data && row.instance && row.instance.purpose != "Demonstration") {
    
            if(row.data.appIntakeRequests) {
                for(var month in row.data.appIntakeRequests.months) {
                    getOrCreateMonth(month).intake += row.data.appIntakeRequests.months[month];
                }
            } 
    
            if(row.data.deploymentRequests) {
                for(var month in row.data.deploymentRequests) {
                    getOrCreateMonth(month).deployment += row.data.deploymentRequests[month];
                }
            }
    
            if(row.data.collaborationRequests) {
                for(var month in row.data.collaborationRequests) {
                    getOrCreateMonth(month).collaboration += row.data.collaborationRequests[month];
                }
            }
        }
    });

    for(var month in TASKS) {
        ws.addRow([moment(month, 'MM/YYYY').format("YYYY-MM"), TASKS[month].deployment, TASKS[month].collaboration, TASKS[month].intake]).commit();
    }

    ws.commit();
};

var processCustomers = (wb, auditData) => {
    var ws = wb.addWorksheet("Customers");

    ws.columns = [
        { header: 'Customer', width: 20 },
        { header: 'Account No.', width: 20 },
        { header: 'Account Type', width: 20 },
        { header: 'Primary Rep', width: 20 },
        { header: 'Solution Consultant', width: 20 },
        { header: 'App Engine Subscriber', width: 22 },
        { header: 'AEMC Installed On', width: 17 },
        { header: 'AEMC Installed On YYYY-MM', width: 12 },
        { header: 'AEMC Version', width: 17 },
    ];
    ws.autoFilter = { from: 'A1', to: 'I1' };

    var CUSTOMERS = {};

    auditData.forEach((row) => {
        if(row.instance && row.instance.account && row.data && row.data.installationStatus && row.data.installationStatus.aemc) {
            var aemc = row.data.installationStatus.aemc;
            var instance = row.instance;
            var account = instance.account;

            if(aemc.installed === true) {
                if(CUSTOMERS[account.accountNo] == undefined){                    
                    CUSTOMERS[account.accountNo] = true;

                    ws.addRow([
                        account.accountName,
                        account.accountNo,
                        account.accountType,
                        account.primarySalesRep,
                        account.solutionConsultant,
                        account.isAppEngineSubscriber,
                        aemc.installedOn,
                        moment(aemc.installedOn, 'YYYY-MM-DD').format("YYYY-MM"),
                        aemc.version
                    ]).commit();
                }
            }
        }
    });

    ws.commit();
};

var processDeploymentCounts = (wb, auditData) => {
    var ws = wb.addWorksheet("Deployment Requests");

    ws.columns = generateColumns([
        { header: 'Month', width: 20 },
        { header: 'Total', width: 20, alignment: { horizontal: 'right' } }
    ]);
    ws.autoFilter = { from: 'A1', to: 'G1' };

    auditData.forEach((row) => {
        if(row.data && row.data.deploymentRequests) {
            for(var month in row.data.deploymentRequests) {
                ws.addRow(generateRowValues(row.instanceName, row.instance, [
                    moment(month, 'MM/YYYY').format("YYYY-MM"),
                    row.data.deploymentRequests[month]])).commit();
            }
        }
    });

    ws.commit();
};

var processCollaborationCounts = (wb, auditData) => {
    var ws = wb.addWorksheet("Collaboration Requests");

    ws.columns = generateColumns([
        { header: 'Month', width: 20 },
        { header: 'Total', width: 20, alignment: { horizontal: 'right' } }
    ]);
    ws.autoFilter = { from: 'A1', to: 'G1' };

    auditData.forEach((row) => {
        if(row.data && row.data.collaborationRequests) {
            for(var month in row.data.collaborationRequests) {
                ws.addRow(generateRowValues(row.instanceName, row.instance, [
                    moment(month, 'MM/YYYY').format("YYYY-MM"),
                    row.data.collaborationRequests[month]])).commit();
            }
        }
    });

    ws.commit();
};

var processIntakeCounts = (wb, auditData) => {
    var ws = wb.addWorksheet("App Intake Requests");

    ws.columns = generateColumns([
        { header: 'Month', width: 20 },
        { header: 'Total', width: 20, alignment: { horizontal: 'right' } }
    ]);
    ws.autoFilter = { from: 'A1', to: 'G1' };

    auditData.forEach((row) => {
        if(row.data && row.data.appIntakeRequests && row.data.appIntakeRequests.months) {
            for(var month in row.data.appIntakeRequests.months) {
                ws.addRow(generateRowValues(row.instanceName, row.instance, [
                    moment(month, 'MM/YYYY').format("YYYY-MM"),
                    row.data.appIntakeRequests.months[month]])).commit();
            }
        }
    });

    ws.commit();
};

var processPipelines = (wb, auditData) => {
    var ws = wb.addWorksheet("Pipeline Configurations");

    ws.columns = generateColumns([
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
    ws.autoFilter = { from: 'A1', to: 'N1' };

    auditData.forEach((row) => {
        if(row.data && row.data.pipelineConfigurations) {
            for(var configId in row.data.pipelineConfigurations) {
                var config = row.data.pipelineConfigurations[configId];
                var environments = 0;

                if(row.data.pipelineConfigurations[configId].environments)
                    environments = row.data.pipelineConfigurations[configId].environments.length;

                ws.addRow(generateRowValues(row.instanceName, row.instance, [
                    configId,
                    config.name, 
                    config.active, 
                    config.createdOn, 
                    config.type.id, 
                    config.type.name, 
                    config.sourceEnvironment.id, 
                    config.sourceEnvironment.name,
                    environments])).commit();
            }
        }
    });
    
    ws.commit();
};

var processPipelineEnvironments = (wb, auditData) => {
    var ws = wb.addWorksheet("Pipeline Environments");

    ws.columns = generateColumns([
        { header: 'Environment ID', width: 20 },
        { header: 'Environment Name', width: 20 },
        { header: 'Instance ID', width: 20 },
        { header: 'Instance URL', width: 20 },
        { header: 'Is Controller', width: 20 },
        { header: 'Order', width: 20, alignment: { horizontal: 'right' } }
    ]);
    ws.autoFilter = { from: 'A1', to: 'K1' };

    auditData.forEach((row) => {
        if(row.data && row.data.pipelineConfigurations) {
            for(var configId in row.data.pipelineConfigurations) {
                var config = row.data.pipelineConfigurations[configId];

                if(config.environments && config.environments.length) {
                    config.environments.forEach(env => {
                        ws.addRow(generateRowValues(row.instanceName, row.instance, [                                        
                            env.environment.id,
                            env.environment.name,
                            env.environment.instanceId,
                            env.environment.instanceUrl,
                            env.environment.isController,
                            parseInt(env.order)])).commit();
                    });
                }                            
            }
        }
    });

    ws.commit();
};

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "aemc-audit.xlsx"
        });

        var fileName = path.join(__dirname, "settings.csv");       

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            //
            // Summary Info
            //
            processSummary(wb, auditData);

            //
            // Customers
            //
            processCustomers(wb, auditData);

            //
            // Tasks by month
            //
            processTasksByMonth(wb, auditData);

            //
            // Deployments by Month
            //
            processDeploymentCounts(wb, auditData);

            //
            // Collaboration Requests by Month
            //
            processCollaborationCounts(wb, auditData);

            //
            // App Intake by Month
            //
            processIntakeCounts(wb, auditData);

            //
            // Pipeline Configurations
            //
            processPipelines(wb, auditData);

            //
            // Pipeline Environments
            //
            processPipelineEnvironments(wb, auditData);
            
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