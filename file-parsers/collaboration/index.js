
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

var processCollaboration = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "collaboration-results.xlsx"
        });

        var fileName = path.join(__dirname, "collaboration.csv");       

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var generalWs = wb.addWorksheet("General");
            var descriptorsWs = wb.addWorksheet("Descriptors");
            var permissionsWs = wb.addWorksheet("Descriptor + Permissions");
            var usageWs = wb.addWorksheet("DD Permission Usage");
            var requestWs = wb.addWorksheet("Collaboration Tasks");
    
            generalWs.columns = generateColumns([
                { header: 'Plugin Installed', width: 20 },
                { header: 'UI Installed', width: 20 },
                { header: 'Requests Installed', width: 20 },
                { header: '# of Requests', width: 18, alignment: { horizontal: 'right' } }
            ]);

            descriptorsWs.columns = generateColumns([
                { header: 'ID', width: 20 },
                { header: 'Name', width: 20 },
                { header: 'Description', width: 20 },
                { header: 'Standard', width: 20 },
                { header: 'Created On', width: 20 },
                { header: '# of apps', width: 20, alignment: { horizontal: 'right' } },
                { header: '# of users', width: 20, alignment: { horizontal: 'right' } },
                { header: '# of groups', width: 18, alignment: { horizontal: 'right' } }
            ]);

            permissionsWs.columns = generateColumns([
                { header: 'ID', width: 20 },
                { header: 'Name', width: 20 },
                { header: 'Standard', width: 20 },
                { header: 'Permission ID', width: 20 },
                { header: 'Permission', width: 20 }
            ]);

            usageWs.columns = generateColumns([
                { header: 'Permission ID', width: 20 },
                { header: 'Name', width: 20 },
                { header: 'Scope', width: 20 },
                { header: '# of users', width: 20 }
            ]);

            requestWs.columns = generateColumns([
                { header: 'Month', width: 20 },
                { header: '# of Collab. Tasks', width: 20, alignment: { horizontal: 'right' } }
            ]);
            
            auditData.forEach((row) => {
                var totalRequests = 0;

                if(row.data && row.data.installationStatus) {
                    if(row.data.requestCounts) {
                        for(var month in row.data.requestCounts) {
                            var count = row.data.requestCounts[month];
                            totalRequests += count;
                        }
                    }

                    generalWs.addRow(
                        generateRowValues(row.instanceName, row.instance, [
                            row.data.installationStatus.pluginInstalled, 
                            row.data.installationStatus.componentInstalled,
                            row.data.installationStatus.requestsInstalled,
                            totalRequests])).commit();

                    if(row.data.descriptors) {
                        for(var id in row.data.descriptors) {
                            var descriptor = row.data.descriptors[id];
                            var apps = {};
                            var userCount = 0;
                            var groupCount = 0;

                            for(var app in descriptor.userCounts) {
                                userCount += descriptor.userCounts[app];
                                apps[app] = true;
                            }

                            for(var app in descriptor.groupCounts) {
                                groupCount += descriptor.groupCounts[app];
                                apps[app] = true;
                            }

                            descriptorsWs.addRow(
                                generateRowValues(row.instanceName, row.instance, [
                                    id, 
                                    descriptor.name,
                                    descriptor.description,
                                    descriptor.standard,
                                    descriptor.createdOn,
                                    Object.keys(apps).length,
                                    userCount,
                                    groupCount])).commit();

                            descriptor.permissions.forEach((permissionId) => {
                                permissionsWs.addRow(
                                    generateRowValues(row.instanceName, row.instance, [
                                        id, 
                                        descriptor.name,
                                        descriptor.standard,
                                        permissionId,
                                        row.data.permissions[permissionId]])).commit();
                            });
                        }
                    }

                    if(row.data.permissionUsage) {
                        for(var id in row.data.permissionUsage) {
                            var permission = row.data.permissionUsage[id];

                            for(var scope in permission.apps){
                                usageWs.addRow(
                                    generateRowValues(row.instanceName, row.instance, [
                                    id,
                                    permission.name,
                                    scope,
                                    permission.apps[scope]])).commit();
                            }
                        }
                    }

                    if(row.data.requestCounts) {
                        for(var month in row.data.requestCounts) {
                            requestWs.addRow(
                                generateRowValues(row.instanceName, row.instance, [
                                month,
                                row.data.requestCounts[month]])).commit();
                        }
                    }
                }
            });

            generalWs.commit();
            descriptorsWs.commit();
            permissionsWs.commit();
            usageWs.commit();
            requestWs.commit();
            
            wb.commit().then(() => {
                resolve();
            });

        });

    });

    return promise;
};


(function(){

    processCollaboration()
        .then(() => { console.log("Done") });

})();