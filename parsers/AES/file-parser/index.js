const ExcelJS = require('exceljs');
const fastCsv = require("fast-csv");
const moment = require('moment');
const EMPTY_PAYLOAD = "Empty Payload";
const AUDIT_STATE_COMPLETED = "Completed";

var FILE_DIRECTORY = "Customer";

var loadInstanceData = () => {
	var promise = new Promise((resolve, reject) => {

		loadAccountData().then((accounts) => {
			var instances = {};

			fastCsv.parseFile("../../instance-data/instances.csv")
				.on("data", data => {
					var instanceName = data[0],
						accountNo = data[2];

					instances[instanceName] = {
						customer: data[1],
						accountNo: accountNo,
						version: data[3],
						purpose: data[4],
						category: data[5],
						subCategory: data[6],
						isAppEngineSubscriber: !(accounts[accountNo] == undefined)
					};
				})
				.on("end", () => {
					console.log("Loaded " + Object.keys(instances).length + " instances.");
					resolve(instances);
				});
		});
	});

	return promise;
};

var loadAccountData = () => {
	var promise = new Promise((resolve, reject) => {
		var accounts = {};

		fastCsv.parseFile("../app-engine-accounts.csv")
			.on("data", data => {
				var accountNo = data[2];

				accounts[accountNo] = {
					accountName: data[1]
				};
			})
			.on("end", rowCount => {
				console.log("Loaded " + Object.keys(accounts).length + " accounts.");
				resolve(accounts);
			});
	});

	return promise;
};

var parseCsvFile = (propertyName, auditData) => {

    if(auditData[propertyName] == undefined)
        auditData[propertyName] = [];

	var parsePayload = function(payload) {
		if(payload && payload.length && payload != EMPTY_PAYLOAD) {
			if(payload.startsWith("*** Script: ")) {
				var jsonString = payload.substring(11);
				try { return JSON.parse(jsonString); } catch(e) {  }
			}
		}
	};

    var fileName = "../" + FILE_DIRECTORY + "/" + propertyName + ".csv";

	var promise = new Promise((resolve, reject) => {
		fastCsv.parseFile(fileName).on("data", data => {
			var row = {
				instanceName: data[4],
				auditState: data[1],
				errorDefinition: data[2],
				errorDescription: data[3],
				success: (data[1] == AUDIT_STATE_COMPLETED),
				data: parsePayload(data[6])
			};

            auditData[propertyName].push(row);

		})
		.on("end", rowCount => resolve(auditData) );
	});

	return promise;
};

var loadAllFiles = (instances) => {
    var promise = new Promise((resolve, reject) => {
        var auditData = {};
        
        parseCsvFile("settings", auditData)
            .then((auditData) => parseCsvFile("roles", auditData))
            .then((auditData) => parseCsvFile("templates", auditData))
            .then((auditData) => parseCsvFile("apps", auditData))
            .then((auditData) => parseCsvFile("artifacts", auditData))
            .then((auditData) => {
                var combined = {};

                //
                // Combined all results into one JSON object
                //
                for(var propertyName in auditData){
                    auditData[propertyName].forEach((row) => {
                        var instanceName = row.instanceName;
    
                        if(combined[instanceName] == undefined)
                            combined[instanceName] = {};
                        if(combined[instanceName][propertyName] == undefined)
                            combined[instanceName][propertyName] = [];
                        
                        combined[instanceName][propertyName].push(row);
                    });
                }

                //
                // Now add the account info
                //
                for(var instanceName in combined) {
                    var instance = combined[instanceName];

                    if(instances[instanceName]){
                        instance.accountInfo = instances[instanceName];
                    }
                }

                resolve(combined);
            });
	});

	return promise;
};

/*
    Write the workbook based on 
    hbstemp: {
        settings: [ [Object] ],
        roles: [ [Object] ],
        templates: [ [Object] ],
        apps: [ [Object] ],
        artifacts: [ [Object] ],
        accountInfo: {
            customer: 'The President And Fellows Of Harvard College',
            accountNo: 'ACCT0025317',
            version: 'glide-orlando-12-11-2019__patch9b-02-04-2021_02-05-2021_2157.zip',
            purpose: 'Subproduction',
            category: 'Customer',
            subCategory: 'Customer / Prospect',
            isAppEngineSubscriber: false
        }
    }
*/
var writeWorkbook = (auditData) => {
    var promise = new Promise((resolve, reject) => {
        var wb = new ExcelJS.Workbook();
        var fileName = "../" + FILE_DIRECTORY + "/processed-results-" + moment().format("YYYY-MM-DD") + ".xlsx";

        var generateColumns = (values) => {
            var columns = [
                { header: 'Instance Name', width: 22 },
                { header: 'Company', width: 42 },
                { header: 'Account No.', width: 13 },
                { header: 'App Engine Subscriber', width: 20 },
                { header: 'Instance Version', width: 63 },
                { header: 'Instance Purpose', width: 16 },
            ];

            return columns.concat(values);
        };

        var generateRowValues = (instanceName, instance, values) => {
            var rowValues = [];

            if(instance.accountInfo)
                rowValues = [instanceName, instance.accountInfo.customer, instance.accountInfo.accountNo, instance.accountInfo.isAppEngineSubscriber, instance.accountInfo.version, instance.accountInfo.purpose];
            else
                rowValues = [instanceName,"","","","",""];

            return rowValues.concat(values);
        };

        //
        // Settings Worksheets
        //
        (function(){

            var generalSheet = wb.addWorksheet('General');
            var usageSheet = wb.addWorksheet('App Usage');
            var propertiesSheet = wb.addWorksheet('System Properties');

            generalSheet.columns = generateColumns([
                { header: 'Licensed for AES', width: 15 },
                { header: 'AES Installed', width: 13 },
                { header: 'AES Installed On', width: 17 },
                { header: 'No. of Pipelines', width: 15 },
                { header: 'Guided Setup Status', width: 19 },
                { header: 'Guided Setup Progress', width: 20 },
                { header: 'No. of Completed Deployment Requests', width: 34 }
            ]);
            generalSheet.autoFilter = { from: 'A1', to: 'M1' };

            usageSheet.columns = generateColumns([
                { header: 'Application', width: 14 },
                { header: 'Month', width: 8 },
                { header: 'No. of Users', width: 12 }
            ]);
            usageSheet.autoFilter = { from: 'A1', to: 'I1' };

            propertiesSheet.columns = generateColumns([
                { header: 'Property Name', width: 46 },
                { header: 'Property Value', width: 27 }
            ]);
            propertiesSheet.autoFilter = { from: 'A1', to: 'H1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                if(instance.settings) {
                    instance.settings.forEach(row => {
                        //
                        // General
                        //
                        if(row.data) {
                            var values = [];
                            var deploymentCount = 0;			
                            var details = row.data.installationDetails;
                            
                            values.push(details.licensed, details.installed, details.installedOn, row.data.pipelineCount);
        
                            if(row.data.guidedSetupStatus && row.data.guidedSetupStatus.status){
                                values.push(row.data.guidedSetupStatus.status, parseInt(row.data.guidedSetupStatus.progress));
                            } else{
                                values.push("","");
                            }
        
                            if(row.data.deploymentRequests){
                                deploymentCount = Object.keys(row.data.deploymentRequests).length;
                            }
        
                            values.push(deploymentCount);
        
                            generalSheet.addRow(generateRowValues(instanceName, instance, values));
                        }

                        //
                        // App Usage
                        //
                        if(row.data && row.data.applicationUsage) {
                            var usage = row.data.applicationUsage;

                            for(var appName in usage){
                                var app = usage[appName];

                                for(var month in app){
                                    usageSheet.addRow(generateRowValues(instanceName, instance, [appName, month, parseInt(app[month])]));
                                }
                            }
                        }

                        //
                        // System Properties
                        //
                        if(row.data && row.data.systemPropertySettings) {
                            for(var propertyName in row.data.systemPropertySettings) {
                                propertiesSheet.addRow(generateRowValues(instanceName, instance,[propertyName, row.data.systemPropertySettings[propertyName]]));
                            }
                        }
                    });
                }
            }

            console.log("Parsed settings");

        })();

        //
        // Templates Worksheet
        //
        (function(){

            const workSheet = wb.addWorksheet('Template Usage');
	
			workSheet.columns = generateColumns([
				{ header: 'Template Name', width: 24 },
				{ header: 'Template ID', width: 32 },
				{ header: 'Created On', width: 17 },
				{ header: 'Is App Template', width: 15 },
				{ header: 'App SysID', width: 32 }
			]);
            workSheet.autoFilter = { from: 'A1', to: 'K1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                if(instance.templates) {
                    instance.templates.forEach(row => {
                        if(row.data && row.data.templateUsage) {
                            var templateInstances = row.data.templateUsage;
    
                            for(var id in templateInstances) {
                                var template = templateInstances[id];
                                var values = [template.templateName, template.templateId, template.createdOn, template.isApp === true, template.appSysId];
                                workSheet.addRow(generateRowValues(instanceName, instance, values));
                            }
                        }
                    });
                }
            }

            console.log("Parsed templates");

        })();

        //
        // Apps Worksheet
        //
        (function(){
            var customAppsSheet = wb.addWorksheet('Custom Apps');
            var storeAppsSheet = wb.addWorksheet('Store Apps');

            customAppsSheet.columns = generateColumns([
                { header: 'App SysID', width: 33 },
                { header: 'App Name', width: 50 },
                { header: 'Scope', width: 20 },
                { header: 'Created', width: 17 },
                { header: 'Template ID', width: 32 },
                { header: 'Template Name', width: 24 },
                { header: 'Is AES App', width: 11 }
            ]);
            customAppsSheet.autoFilter = { from: 'A1', to: 'M1' };

            storeAppsSheet.columns = generateColumns([
                { header: 'App SysID', width: 33 },
                { header: 'App Name', width: 50 },
                { header: 'Scope', width: 20 },
                { header: 'Installed On', width: 17 }
            ]);
            storeAppsSheet.autoFilter = { from: 'A1', to: 'J1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                if(instance.apps) {
                    instance.apps.forEach(row => {
                        if(row.data && row.data.customApps) {
                            var apps = row.data.customApps;

                            for(var id in apps) {
                                var app = apps[id];
                                var values = [id, app.name, app.scope, app.createdOn, app.tId, app.tName, app.aes === true];
                                customAppsSheet.addRow(generateRowValues(instanceName, instance, values));
                            }
                        }

                        if(row.data && row.data.customStoreApps) {
                            var apps = row.data.customStoreApps;

                            for(var id in apps) {
                                var app = apps[id];
                                var values = [id, app.name, app.scope, app.installedOn];
                                // TODO: do a lookup on all the custom apps, find match and log whether its an AES app
                                storeAppsSheet.addRow(generateRowValues(instanceName, instance, values));
                            }
                        }
                    });
                }
            }

            console.log("Parsed apps");

        })();

        //
        // Artifacts Worksheet
        //
        (function(){
            const workSheet = wb.addWorksheet('AES App Artifacts');
	
			workSheet.columns = generateColumns([
				{ header: 'Artifact', width: 41 },
				{ header: 'No. of artifacts across all apps', width: 26 },
				{ header: 'No. of apps w/ artifact', width: 20 }
			]);
            workSheet.autoFilter = { from: 'A1', to: 'I1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                if(instance.artifacts) {
                    instance.artifacts.forEach(row => {
                        if(row.data && row.data.appArtifacts) {
                            for(var artifactName in row.data.appArtifacts){
                                var artifact = row.data.appArtifacts[artifactName];
                                workSheet.addRow(generateRowValues(instanceName, instance, [artifactName, artifact.totalCount, artifact.apps]));
                            }
                        }
                    });
                }
            }

            console.log("Parsed artifacts");

        })();

        //
        // Roles Worksheet
        //
        (function(){
            const workSheet = wb.addWorksheet('Role Counts');
	
			workSheet.columns = generateColumns([
				{ header: 'AES - Total', width: 11 },
				{ header: 'AES - Logged in <= 30 days', width: 22 },
				{ header: 'AES - Logged in <= 90 days', width: 22 },
				{ header: 'Delegated Dev - Total', width: 19 },
				{ header: 'Delegated Dev - Logged in <= 30 days', width: 31 },
				{ header: 'Delegated Dev - Logged in <= 90 days', width: 31 },
			]);
            workSheet.autoFilter = { from: 'A1', to: 'L1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                if(instance.roles) {
                    instance.roles.forEach(row => {
                        if(row.data && row.data.developerRoles && row.data.developerRoles.aesUsers) {
                            var aesUsers = row.data.developerRoles.aesUsers;
                            var delegatedUsers = row.data.developerRoles.delegatedDevelopers;

                            workSheet.addRow(generateRowValues(instanceName, instance, [aesUsers.total, aesUsers["30"], aesUsers["90"], delegatedUsers.total, delegatedUsers["30"], delegatedUsers["90"]]));
                        }
                    });
                }
            }

            console.log("Parsed roles");

        })();

        //
        // Errors
        //
        (function(){

            const workSheet = wb.addWorksheet('Errors');

            workSheet.columns = generateColumns([
                { header: 'Audit', width: 8 },
                { header: 'Audit State', width: 12 },
                { header: 'Error Definition', width: 15 },
                { header: 'Error Description', width: 42 }
            ]);
            workSheet.autoFilter = { from: 'A1', to: 'J1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                for(var auditName in instance) {
                    var audit = instance[auditName];

                    if(Array.isArray(audit)){
                        audit.forEach((row) => {
                            if(!row.success && instanceName != "Instance Name") {
                                workSheet.addRow(generateRowValues(instanceName, instance,[auditName, row.auditState, row.errorDefinition, row.errorDescription]));
                            }
                        });
                    }
                }
            }

            console.log("Parsed errors");

        })();

        wb.xlsx.writeFile(fileName).then(() => {
            console.log("Created file " + fileName);
            resolve();
        });
	});

	return promise;
};

(function(){
    var args = process.argv;

    if(args && args.length >= 3)
        FILE_DIRECTORY = args[2];

    loadInstanceData()
        .then((instances) => loadAllFiles(instances))
        .then((auditData) => writeWorkbook(auditData));

})();