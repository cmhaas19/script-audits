
const path = require('path');
const sharedData = require('../shared/shared');
const ExcelJS = require('exceljs');
const moment = require("moment");

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

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "pipelines-results.xlsx"
        });

        var fileName = path.join(__dirname, "pipelines.csv");       

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

            //
            // Pipeline Installations
            //
            (function(){
                var ws = wb.addWorksheet("Installation Status");

                ws.columns = generateColumns([
                    { header: 'Legacy Model Installed', width: 20 },
                    { header: 'Currrent Model Installed', width: 20 }
                ]);

                auditData.forEach((row) => {
                    if(row.data && row.data.installationStatus) {
                        if(row.data.installationStatus.oldModelInstalled == true || row.data.installationStatus.newModelInstalled == true) {
                            ws.addRow(generateRowValues(row.instanceName, row.instance, [
                                row.data.installationStatus.oldModelInstalled, 
                                row.data.installationStatus.newModelInstalled])).commit();
                        }
                    }
                });

                ws.commit();

            })();

            //
            // Deployments by Month
            //
            (function(){
                var ws = wb.addWorksheet("Deployment Requests");

                ws.columns = generateColumns([
                    { header: 'Month', width: 20 },
                    { header: 'Deployment Requests - Legacy Model', width: 20 },
                    { header: 'Deployment Requests - Current Model', width: 20 }
                ]);

                auditData.forEach((row) => {
                    if(row.data && row.data.deploymentRequests) {
                        for(var month in row.data.deploymentRequests) {
                            var deployments = row.data.deploymentRequests[month];

                            ws.addRow(generateRowValues(row.instanceName, row.instance, [
                                month,
                                deployments.oldModel, 
                                deployments.newModel])).commit();
                        }
                    }
                });

                ws.commit();

            })();

            //
            // Pipeline Configurations
            //
            (function(){
                var ws = wb.addWorksheet("Pipeline Configurations");

                ws.columns = generateColumns([
                    { header: 'Pipeline ID', width: 20 },
                    { header: 'Pipeline Name', width: 20 },
                    { header: 'Pipeline Active', width: 20 },
                    { header: 'Pipeline Created On', width: 20 },
                    { header: 'Pipeline Type ID', width: 20 },
                    { header: 'Pipeline Name', width: 20 },
                    { header: 'Source Environment ID', width: 20 },
                    { header: 'Source Environment Name', width: 20 }
                ]);

                auditData.forEach((row) => {
                    if(row.data && row.data.pipelineConfigurations) {
                        for(var configId in row.data.pipelineConfigurations) {
                            var config = row.data.pipelineConfigurations[configId];

                            ws.addRow(generateRowValues(row.instanceName, row.instance, [
                                configId,
                                config.name, 
                                config.active, 
                                config.createdOn, 
                                config.type.id, 
                                config.type.name, 
                                config.sourceEnvironment.id, 
                                config.sourceEnvironment.name])).commit();
                        }
                    }
                });
                
                ws.commit();
                
            })();

            //
            // Pipeline Environments
            //
            (function(){
                var ws = wb.addWorksheet("Pipeline Environments");

                ws.columns = generateColumns([
                    { header: 'Environment ID', width: 20 },
                    { header: 'Environment Name', width: 20 },
                    { header: 'Instance ID', width: 20 },
                    { header: 'Instance URL', width: 20 },
                    { header: 'Is Controller', width: 20 },
                    { header: 'Order', width: 20 }
                ]);

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
                                        env.order])).commit();
                                });
                            }                            
                        }
                    }
                });

                ws.commit();

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