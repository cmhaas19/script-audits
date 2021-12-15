const ExcelJS = require('exceljs');
const fastCsv = require("fast-csv");
const fs = require('fs')
const moment = require('moment');
const EMPTY_PAYLOAD = "Empty Payload";
const AUDIT_STATE_COMPLETED = "Completed";

var FILE_DIRECTORY = "Customer";

var loadInstanceData = () => {
	var promise = new Promise((resolve, reject) => {

		loadAccountData().then((accounts) => {
			var instances = {};

			fastCsv.parseFile("../shared/" + FILE_DIRECTORY + "-instances.csv")
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

		fastCsv.parseFile("../shared/app-engine-accounts.csv")
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

    var fileName = FILE_DIRECTORY + "/" + propertyName + ".csv";

	var promise = new Promise((resolve, reject) => {
		fastCsv.parseFile(fileName).on("data", data => {
			var row = {
				instanceName: data[2],
				auditState: data[0],
				errorDescription: data[1],
				success: (data[0] == AUDIT_STATE_COMPLETED),
				data: parsePayload(data[3])
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
                //console.log(combined);

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
        var fileName = FILE_DIRECTORY + "/processed-results.xlsx";
        

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

        var overviewData = {
            lastUpdated: () => {
                return fs.statSync(FILE_DIRECTORY + "/settings.csv").mtime;
            },
            instances: {
                successful: 0,
                excluded: 0,
                errors: 0
            },
            totalCustomers: {},
            installs: {
                instances: 0,
                customers: {}
            },
            apps: {
                totalCreated: 0,
                current: 0,
                totalInProduction: 0
            }
        };

        //
        // Start the overview sheet here so it's first
        //
        var overviewSheet = wb.addWorksheet('Overview');
        overviewSheet.columns = [
            { header: '', width: 34 },
            { header: '', width: 34 }
        ];

        //
        // Get template names (in english)
        //
        var TEMPLATE_NAMES = {};

        for(var instanceName in auditData){
            var instance = auditData[instanceName];

            if(instance.templates) {
                instance.templates.forEach(row => {
                    if(row.data && row.data.currentLanguage === "en") {
                        if(row.data.appTemplates){
                            for(var templateId in row.data.appTemplates) {
                                var templateInstance = row.data.appTemplates[templateId];
                                var templateName = templateInstance.templateName;
    
                                if(templateName && templateName.length && templateName.indexOf("?") == -1) {
                                    TEMPLATE_NAMES[templateId] = templateName;
                                }
                            }
                        }
                        if(row.data.objectTemplates){
                            for(var templateId in row.data.objectTemplates) {
                                var templateInstance = row.data.objectTemplates[templateId];
                                var templateName = templateInstance.templateName;
    
                                if(templateName && templateName.length && templateName.indexOf("?") == -1) {
                                    TEMPLATE_NAMES[templateId] = templateName;
                                }
                            }
                        }
                    }
                });                
            }
        }

        //
        // Settings Worksheets
        //
        (function(){

            var generalSheet = wb.addWorksheet('General');
            var customerSheet = wb.addWorksheet('Customers');
            var usageSheet = wb.addWorksheet('App Usage');
            var propertiesSheet = wb.addWorksheet('System Properties');
            var customers = {};            

            generalSheet.columns = generateColumns([
                { header: 'Licensed for AES', width: 15 },
                { header: 'AES Installed', width: 13 },
                { header: 'AES Installed On', width: 17 },
                { header: 'AES Installed On YYYY-MM', width: 12 },
                { header: 'AES Version', width: 17 },
                { header: 'No. of Pipelines', width: 15 },
                { header: 'Guided Setup Status', width: 19 },
                { header: 'Guided Setup Progress', width: 20 },
                { header: 'No. of Completed Deployment Requests', width: 34 },
                { header: 'App Intake Installed?', width: 20 },
                { header: 'App Intake Active?', width: 20 },
                { header: 'No. of App Intake Requests', width: 20 }
            ]);
            generalSheet.autoFilter = { from: 'A1', to: 'R1' };

            customerSheet.columns = [
                { header: 'Customer', width: 20 },
                { header: 'Account No.', width: 20 },
                { header: 'AES Installed On', width: 17 },
                { header: 'AES Installed On YYYY-MM', width: 12 }
            ];
            customerSheet.autoFilter = { from: 'A1', to: 'D1' };

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
                            var installedFormated = "";

                            if(details.installed === true && details.installedOn) {
                                installedFormated = moment(details.installedOn).format("YYYY-MM");
                            }
                            
                            values.push(details.licensed, details.installed, details.installedOn, installedFormated, details.version, row.data.pipelineCount);
        
                            if(row.data.guidedSetupStatus && row.data.guidedSetupStatus.status){
                                values.push(row.data.guidedSetupStatus.status, parseInt(row.data.guidedSetupStatus.progress));
                            } else{
                                values.push("","");
                            }
        
                            if(row.data.deploymentRequests){
                                deploymentCount = Object.keys(row.data.deploymentRequests).length;
                            }

                            if(details.installed && instance.accountInfo){
                                overviewData.installs.instances++;
                                overviewData.installs.customers[instance.accountInfo.customer] = true;

                                //
                                // Track the minimum install date by customer
                                //
                                if(customers[instance.accountInfo.customer] == undefined)
                                    customers[instance.accountInfo.customer] = { installedOn: details.installedOn, accountNo: instance.accountInfo.accountNo };

                                if(moment(details.installedOn).isBefore(customers[instance.accountInfo.customer].installedOn)){
                                    customers[instance.accountInfo.customer].installedOn = details.installedOn;
                                }

                            }   
        
                            values.push(deploymentCount);

                            //
                            // App Intake
                            //
                            if(row.data.appIntakeUsage) {
                                values.push(row.data.appIntakeUsage.installed, row.data.appIntakeUsage.active, row.data.appIntakeUsage.requestCounts);
                            }
        
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

                    if(instance.accountInfo && instance.accountInfo.customer)
                        overviewData.totalCustomers[instance.accountInfo.customer] = true;
                }
            }

            //
            // Customer worksheet
            //
            for(var name in customers) {
                var customer = customers[name];
                customerSheet.addRow([name, customer.accountNo, customer.installedOn, moment(customer.installedOn).format("YYYY-MM")]);
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
                { header: 'Is App Template', width: 15 },
				{ header: 'Month', width: 17 },
				{ header: 'Count', width: 11, alignment: { horizontal: 'right' } }
			]);
            workSheet.autoFilter = { from: 'A1', to: 'J1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                if(instance.templates) {
                    instance.templates.forEach(row => {
                        if(row.data && row.data.appTemplates) {
                            var appTemplates = row.data.appTemplates;
    
                            for(var templateId in appTemplates) {
                                var template = appTemplates[templateId];
                                var templateName = TEMPLATE_NAMES[templateId];

                                for(var month in template.months) {
                                    var count = parseInt(template.months[month]);
                                    overviewData.apps.totalCreated += count;
                                    var values = [templateName, templateId, true, moment(month, 'MM/YYYY').format("YYYY-MM"), count];
                                    workSheet.addRow(generateRowValues(instanceName, instance, values));
                                }
                            }
                        }

                        if(row.data && row.data.objectTemplates) {
                            var objectTemplates = row.data.objectTemplates;
    
                            for(var templateId in objectTemplates) {
                                var template = objectTemplates[templateId];
                                var templateName = TEMPLATE_NAMES[templateId];

                                for(var month in template.months) {
                                    var values = [templateName, templateId, false, moment(month, 'MM/YYYY').format("YYYY-MM"), parseInt(template.months[month])];
                                    workSheet.addRow(generateRowValues(instanceName, instance, values));
                                }
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
            var aesAppsSheet = wb.addWorksheet('AES Apps');
            var customAESApps = {};

            customAppsSheet.columns = generateColumns([
                { header: 'App SysID', width: 33 },
                { header: 'App Name', width: 50 },
                { header: 'Scope', width: 20 },
                { header: 'Created', width: 17 },
                { header: 'Template ID', width: 32 },
                { header: 'Template Name', width: 24 },
                { header: 'Is AES App', width: 11 },
                { header: 'Has Logo', width: 11 },
                { header: 'Linked to Source Control', width: 28 }
            ]);
            customAppsSheet.autoFilter = { from: 'A1', to: 'N1' };

            storeAppsSheet.columns = generateColumns([
                { header: 'App SysID', width: 33 },
                { header: 'App Name', width: 50 },
                { header: 'Scope', width: 20 },
                { header: 'Installed On', width: 17 },
                { header: 'Is AES App', width: 11 }
            ]);
            storeAppsSheet.autoFilter = { from: 'A1', to: 'K1' };

            aesAppsSheet.columns = [
                { header: 'Customer', width: 20 },
                { header: 'Account No.', width: 20 },
                { header: 'App Name', width: 50 },
                { header: 'App SysID', width: 33 },                
                { header: 'Scope', width: 20 },
                { header: 'Created', width: 18 },
                { header: 'Created YYYY-MM', width: 15 },
                { header: 'Template ID', width: 32 },
                { header: 'Template Name', width: 24 },
                { header: 'Is Production', width: 24 },
                { header: 'Production Install', width: 24 },
                { header: 'Production Install YYYY-MM', width: 24 },
            ];
            aesAppsSheet.autoFilter = { from: 'A1', to: 'L1' };

            //
            // Custom apps first
            //
            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                if(instance.apps) {
                    instance.apps.forEach(row => {
                        if(row.data && row.data.customApps) {
                            var apps = row.data.customApps;

                            for(var id in apps) {
                                var app = apps[id];
                                var templateName = TEMPLATE_NAMES[app.tId];
                                var hasLogo = (app.logo != null && app.logo.length > 0);
                                var values = [id, app.name, app.scope, app.createdOn, app.tId, templateName, app.aes === true, hasLogo, app.sourceControl];
                                customAppsSheet.addRow(generateRowValues(instanceName, instance, values));                                

                                if(app.aes === true) {
                                    overviewData.apps.current++;
                                    customAESApps[id] = {
                                        accountInfo: instance.accountInfo,
                                        appInfo: app
                                    };
                                }                                    
                            }
                        }
                    });
                }
            }

            //
            // Now do it for store apps
            //
            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                if(instance.apps) {
                    instance.apps.forEach(row => {
                        if(row.data && row.data.customStoreApps) {
                            var apps = row.data.customStoreApps;

                            for(var id in apps) {
                                var app = apps[id];
                                var isAESApp = !(customAESApps[id] == undefined);
                                var values = [id, app.name, app.scope, app.installedOn, isAESApp];
                                storeAppsSheet.addRow(generateRowValues(instanceName, instance, values));

                                if(isAESApp && instance.accountInfo.purpose == "Production") {
                                    overviewData.apps.totalInProduction++;
                                    customAESApps[id].production = app.installedOn;
                                }                                    
                            }
                        }
                    });
                }
            }

            //
            // AES Apps
            //
            for(var id in customAESApps) {
                var app = customAESApps[id];
                var templateName = TEMPLATE_NAMES[app.appInfo.tId];

                aesAppsSheet.addRow([
                    app.accountInfo.customer,
                    app.accountInfo.accountNo,
                    app.appInfo.name,
                    id,
                    app.appInfo.scope,
                    app.appInfo.createdOn,
                    moment(app.appInfo.createdOn).format("YYYY-MM"),
                    app.appInfo.tId,
                    templateName,
                    (app.production == undefined ? false : true),
                    (app.production == undefined ? "" : app.production),
                    (app.production == undefined ? "" : moment(app.production).format("YYYY-MM"))
                ]);
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
                { header: 'Error Description', width: 42 }
            ]);
            workSheet.autoFilter = { from: 'A1', to: 'J1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                for(var auditName in instance) {
                    var audit = instance[auditName];

                    if(Array.isArray(audit)){
                        audit.forEach((row) => {

                            if(!row.success && instanceName != "Instance Name" && instanceName != "u_instance_name") {
                                workSheet.addRow(generateRowValues(instanceName, instance,[auditName, row.auditState, row.errorDescription]));
                            }

                            if(auditName == "settings"){
                                if(!row.success){
                                    switch(row.auditState){
                                        case "Failed":
                                            overviewData.instances.errors++;
                                            break;
                                        case "Excluded":
                                            overviewData.instances.excluded++;
                                            break;
                                    }
                                } else {
                                    overviewData.instances.successful++;
                                }
                            }
                        });
                    }
                }
            }

            console.log("Parsed errors");

        })();

        //
        // Now populate the Overview worksheet
        //
        (function(sheet){
            sheet.addRow(["Last updated:", moment(overviewData.lastUpdated()).format("MMMM Do YYYY, h:mm:ss a")]);
            sheet.addRow([]);
            sheet.addRow(["No. of Instances Audited Successfully:", overviewData.instances.successful]);
            sheet.addRow(["No. of Instances Excluded:", overviewData.instances.excluded]);
            sheet.addRow(["No. of Instances with Errors:", overviewData.instances.errors]);
            sheet.addRow([]);
            sheet.addRow(["Total customers audited successfully:", Object.keys(overviewData.totalCustomers).length]);
            sheet.addRow([]);
            sheet.addRow(["Total AES installs (instances):", overviewData.installs.instances]);
            sheet.addRow(["Total AES installs (customers):", Object.keys(overviewData.installs.customers).length]);
            sheet.addRow([]);
            sheet.addRow(["Total # of AES apps (created):", overviewData.apps.totalCreated]);
            sheet.addRow(["Total # of AES apps (current):", overviewData.apps.current]);
            sheet.addRow(["Total # of AES apps in production:", overviewData.apps.totalInProduction]);

            //
            // Apply cell styling
            //
            sheet.getCell('B2').font = { bold: true };

            for(var i = 1; i < 100;i++){
                sheet.getCell('B' + i.toString()).alignment = { horizontal: 'right' };
            }

            [2,4,5,6,8,10,11,13,14].forEach((n) => {
                sheet.getCell('B' + n.toString()).numFmt = '#,##0';
            });

        })(overviewSheet);

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