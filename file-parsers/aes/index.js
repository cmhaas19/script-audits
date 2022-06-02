const ExcelJS = require('exceljs');
const fastCsv = require("fast-csv");
const fs = require('fs');
const moment = require('moment');
const sharedData = require('../shared/shared');

var FILE_DIRECTORY = "Customer";

var parseCsvFile = (propertyName, auditData) => {
    var promise = new Promise((resolve, reject) => { 
        var fileName = FILE_DIRECTORY + "/" + propertyName + ".csv";

        sharedData.parseCsvFile(fileName).then((data) => {
            auditData[propertyName] = data;
            resolve(auditData);
        });
    });

    return promise;
};

var loadAllFiles = (instances) => {
    var promise = new Promise((resolve, reject) => {
        var auditData = {};
        
        parseCsvFile("artifacts", auditData)            
            .then((auditData) => parseCsvFile("customApps", auditData))
            .then((auditData) => parseCsvFile("customAppsAggregates", auditData))
            .then((auditData) => parseCsvFile("roles", auditData))
            .then((auditData) => parseCsvFile("settings", auditData))
            .then((auditData) => parseCsvFile("storeApps", auditData))
            .then((auditData) => parseCsvFile("templateApps", auditData)) 
            .then((auditData) => parseCsvFile("templates", auditData))
            .then((auditData) => parseCsvFile("templatesCustom", auditData))
            .then((auditData) => parseCsvFile("templatesInstalled", auditData))
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
                        instance.instanceInfo = instances[instanceName];
                    }
                }

                //console.log(combined);

                resolve(combined);
            });
	});

	return promise;
};

var aggregateCustomApps = (auditData) => {
    var combinedApps = {};

    for(var instanceName in auditData){
        var instance = auditData[instanceName];
        var instanceInfo = instance.instanceInfo;
        var isProduction = false;

        if(instanceInfo && instanceInfo.purpose)
            isProduction = (instanceInfo.purpose == "Production");

        if(instance.customApps) {
            instance.customApps.forEach((row) => {
                if(row.data && row.data.customApps) {
                    row.data.customApps.forEach((id) => {
                        if(combinedApps[id] == undefined) {
                            combinedApps[id] = {
                                instanceInfo: instanceInfo,
                                isProduction: isProduction
                            };
                        }

                        if(!combinedApps[id].isProduction)
                            combinedApps[id].isProduction = isProduction;
                    });
                }
            });
        }

        if(instance.storeApps) {
            instance.storeApps.forEach((row) => {
                if(row.data && row.data.storeApps) {
                    for(var id in row.data.storeApps) {
                        var app = row.data.storeApps[id];

                        if(combinedApps[id] == undefined) {
                            combinedApps[id] = {
                                instanceInfo: instanceInfo
                            };
                        } 

                        combinedApps[id].installedOn = app;

                        if(!combinedApps[id].isProduction)
                            combinedApps[id].isProduction = isProduction;
                    }
                }
            });
        }

        if(instance.templateApps) {
            instance.templateApps.forEach((row) => {
                if(row.data && row.data.aesApps) {
                    for(var id in row.data.aesApps) {
                        var app = row.data.aesApps[id];

                        if(combinedApps[id] == undefined) {
                            combinedApps[id] = {
                                instanceInfo: instanceInfo,
                                isProduction: false
                            };
                        }

                        combinedApps[id].templateId = app;
                    }
                }
            });
        }
    }

    return combinedApps;

};

/*
    Write the workbook based on 
    acxiom: {
        settings: [ [Object] ],
        roles: [ [Object] ],
        templates: [ [Object] ],
        templateApps: [ [Object] ],
        templatesInstalled: [ [Object] ],
        templatesCustom: [ [Object] ],
        customApps: [ [Object] ],
        customAppsAggregates: [ [Object] ],
        storeApps: [ [Object] ],
        artifacts: [ [Object] ],
        instanceInfo: {
            account: {
                accountName: 'Acxiom Corp',
                accountNo: 'ACCT0001182',
                isAppEngineSubscriber: true
            },            
            version: 'glide-rome-06-23-2021__patch2-09-23-2021_10-06-2021_1453.zip',
            purpose: 'Production',
            category: '',
            subCategory: ''            
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

            if(instance.instanceInfo && instance.instanceInfo.account) {
                var account = instance.instanceInfo.account;
                rowValues = [instanceName, account.accountName, account.accountNo, account.accountType, account.primarySalesRep, account.solutionConsultant, account.isAppEngineSubscriber, instance.instanceInfo.version, instance.instanceInfo.purpose];
            }                
            else {
                rowValues = [instanceName,"","","","","","","",""];
            }
                

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
                { header: 'Oracle Db', width: 12 },
                { header: 'Licensed for AES', width: 15 },
                { header: 'AES Installed', width: 13 },
                { header: 'AES Installed On', width: 17 },
                { header: 'AES Installed On YYYY-MM', width: 12 },
                { header: 'AES Version', width: 17 },
                { header: 'Guided Setup Status', width: 19 },
                { header: 'Guided Setup Progress', width: 20 },
                { header: 'Polaris Enabled', width: 20 },
                { header: 'Legacy Workspace Enabled', width: 20 }
            ]);
            generalSheet.autoFilter = { from: 'A1', to: 'T1' };

            customerSheet.columns = [
                { header: 'Customer', width: 20 },
                { header: 'Account No.', width: 20 },
                { header: 'Account Type', width: 20 },
                { header: 'Primary Rep', width: 20 },
                { header: 'Solution Consultant', width: 20 },
                { header: 'AES Installed On', width: 17 },
                { header: 'AES Installed On YYYY-MM', width: 12 }
            ];
            customerSheet.autoFilter = { from: 'A1', to: 'G1' };

            usageSheet.columns = generateColumns([
                { header: 'Application', width: 14 },
                { header: 'Month', width: 8 },
                { header: 'No. of Users', width: 12 }
            ]);
            usageSheet.autoFilter = { from: 'A1', to: 'L1' };

            propertiesSheet.columns = generateColumns([
                { header: 'Property Name', width: 46 },
                { header: 'Property Value', width: 27 }
            ]);
            propertiesSheet.autoFilter = { from: 'A1', to: 'K1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                if(instance.settings) {
                    instance.settings.forEach(row => {
                        //
                        // General
                        //
                        if(row.data) {
                            var values = [];		
                            var details = row.data.installationDetails;
                            var installedFormated = "";

                            values.push(instance.instanceInfo != undefined ? instance.instanceInfo.usesOracle : "false");

                            if(details.installed === true && details.installedOn) {
                                installedFormated = moment(details.installedOn).format("YYYY-MM");
                            }
                            
                            values.push(details.licensed, details.installed, details.installedOn, installedFormated, details.version);
        
                            if(row.data.guidedSetupStatus && row.data.guidedSetupStatus.status){
                                values.push(row.data.guidedSetupStatus.status, parseInt(row.data.guidedSetupStatus.progress));
                            } else{
                                values.push("","");
                            }

                            if(details.installed && instance.instanceInfo && instance.instanceInfo.account){
                                overviewData.installs.instances++;
                                overviewData.installs.customers[instance.instanceInfo.account.accountName] = true;

                                //
                                // Track the minimum install date by customer
                                //
                                if(customers[instance.instanceInfo.account.accountNo] == undefined)
                                    customers[instance.instanceInfo.account.accountNo] = { installedOn: details.installedOn, account: instance.instanceInfo.account };

                                if(moment(details.installedOn).isBefore(customers[instance.instanceInfo.account.accountNo].installedOn)){
                                    customers[instance.instanceInfo.account.accountNo].installedOn = details.installedOn;
                                }

                            }

                            //
                            // Polaris & Legacy Workspace
                            //
                            var polarisEnabled = "";
                            if(row.data.polarisSettings) {
                                polarisEnabled = row.data.polarisSettings["glide.ui.polaris.experience"].toString().toLowerCase();
                            }

                            values.push(polarisEnabled, row.data.legacyWorkspaceEnabled);
        
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

                    if(instance.instanceInfo && instance.instanceInfo.account)
                        overviewData.totalCustomers[instance.instanceInfo.account.accountName] = true;
                }
            }

            //
            // Customer worksheet
            //
            for(var accountNo in customers) {
                var customer = customers[accountNo];
                customerSheet.addRow([
                    customer.account.accountName, 
                    customer.account.accountNo, 
                    customer.account.accountType, 
                    customer.account.primarySalesRep, 
                    customer.account.solutionConsultant, 
                    customer.installedOn, 
                    moment(customer.installedOn).format("YYYY-MM")]);
            }

            console.log("Parsed settings");

        })();


        //
        // Custom Apps
        //
        (function(){
            var customAppsSheet = wb.addWorksheet('Custom Apps');

            customAppsSheet.columns = [
                { header: 'Company', width: 42 },
                { header: 'Account No.', width: 12 },
                { header: 'Account Type', width: 17 },
                { header: 'Primary Rep', width: 22 },
                { header: 'Solution Consultant', width: 23 },
                { header: 'App Engine Subscriber', width: 22 },
                { header: 'Is Production App', width: 33 },
                { header: 'App SysID', width: 33 },
                { header: 'Template ID', width: 32 },
                { header: 'Template Name', width: 25 },
                { header: 'Store App - Installed On', width: 21 },
                { header: 'Store App - Installed On YYYY-MM', width: 28 },
            ];
            customAppsSheet.autoFilter = { from: 'A1', to: 'L1' };

            var allCustomApps = aggregateCustomApps(auditData);

            for(var id in allCustomApps) {
                var app = allCustomApps[id];
                var formattedDate = "";

                if(app.instanceInfo == undefined){
                    console.log("Could not find customer info for " + id);
                    continue;
                }
                    
                if(app.installedOn && app.installedOn.length) {
                    formattedDate = moment(app.installedOn, 'YYYY-MM-DD').format("YYYY-MM");
                }       

                customAppsSheet.addRow([
                    app.instanceInfo.account.accountName,
                    app.instanceInfo.account.accountNo,
                    app.instanceInfo.account.accountType,
                    app.instanceInfo.account.primarySalesRep,
                    app.instanceInfo.account.solutionConsultant,
                    app.instanceInfo.account.isAppEngineSubscriber,
                    app.isProduction,
                    id,
                    app.templateId,
                    TEMPLATE_NAMES[app.templateId],
                    app.installedOn,
                    (formattedDate == "Invalid date" ? "" : formattedDate)
                ]); 

                if(app.templateId && app.templateId.length) {
                    overviewData.apps.totalCreated++;

                    if(app.isProduction == true) {
                        overviewData.apps.totalInProduction++;
                    }
                }
            }

        })();

        //
        // Custom App Aggregates
        //
        (function(){
            var sheet = wb.addWorksheet('Custom App Aggregates');

            sheet.columns = generateColumns([
                { header: 'Month', width: 10 },
                { header: '# of Apps', width: 12 }
            ]);
            sheet.autoFilter = { from: 'A1', to: 'K1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                if(instance.customAppsAggregates) {
                    instance.customAppsAggregates.forEach(row => {
                        if(row.data && row.data.appsByCreatedDate) {
                            var months = row.data.appsByCreatedDate;
    
                            for(var month in months) {
                                var apps = months[month];

                                sheet.addRow(generateRowValues(instanceName, instance, [
                                    moment(month, 'MM/YYYY').format("YYYY-MM"),
                                    apps
                                ]));
                            }
                        }
                    });
                }
            }
        })();

        //
        // Installed Templates
        //
        (function(){

            const workSheet = wb.addWorksheet('Templates - Installed');
	
			workSheet.columns = generateColumns([
                { header: 'Template ID', width: 32 },
				{ header: 'Template Name', width: 24 },	
                { header: 'Active', width: 15 },
                { header: 'Is App', width: 15 },
                { header: 'Is Snapshot', width: 15 },
                { header: 'Scope', width: 15 },
                { header: 'Type', width: 15 },
				{ header: 'Created On', width: 17 },
                { header: 'Created On YYYY-MM', width: 28 },
			]);
            workSheet.autoFilter = { from: 'A1', to: 'P1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                if(instance.templatesInstalled) {
                    instance.templatesInstalled.forEach(row => {
                        if(row.data && row.data.installedTemplates) {
                            var templates = row.data.installedTemplates;
    
                            for(var templateId in templates) {
                                var template = templates[templateId];

                                workSheet.addRow(generateRowValues(instanceName, instance, [
                                    templateId,
                                    template.name,
                                    template.active,
                                    template.isApp,
                                    template.snapshot,
                                    template.scope,
                                    template.type,
                                    template.createdOn,
                                    moment(template.createdOn, 'YYYY-MM-DD').format("YYYY-MM")
                                ]));
                            }
                        }
                    });
                }
            }

            console.log("Parsed custom templates");

        })();

        //
        // Templates Worksheet
        //
        (function(){

            const workSheet = wb.addWorksheet('Templates - Usage');
	
			workSheet.columns = generateColumns([
				{ header: 'Template Name', width: 24 },
				{ header: 'Template ID', width: 32 },
                { header: 'Is App Template', width: 15 },
				{ header: 'Month', width: 17 },
				{ header: 'Count', width: 11, alignment: { horizontal: 'right' } }
			]);
            workSheet.autoFilter = { from: 'A1', to: 'N1' };

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
        // Custom Templates Worksheet
        //
        (function(){

            const workSheet = wb.addWorksheet('Templates - Custom');
	
			workSheet.columns = generateColumns([
                { header: 'Template ID', width: 32 },
				{ header: 'Template Name', width: 24 },	
                { header: 'Type', width: 24 },	
                { header: 'Active', width: 15 },			
                { header: 'Scope', width: 15 },
				{ header: 'Created On', width: 17 },
                { header: 'Created On YYYY-MM', width: 28 },
			]);
            workSheet.autoFilter = { from: 'A1', to: 'P1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                if(instance.templatesCustom) {
                    instance.templatesCustom.forEach(row => {
                        if(row.data && row.data.templates) {
                            var templates = row.data.templates;
    
                            for(var templateId in templates) {
                                var template = templates[templateId];
                                //var templateType = TEMPLATE_TYPES[template.type];

                                workSheet.addRow(generateRowValues(instanceName, instance, [
                                    templateId,
                                    template.name,
                                    template.type,
                                    template.active,
                                    template.scope,
                                    template.createdOn,
                                    moment(template.createdOn, 'YYYY-MM-DD').format("YYYY-MM")
                                ]));
                            }
                        }
                    });
                }
            }

            console.log("Parsed custom templates");

        })();

        //
        // Custom Template Content Worksheet
        //
        (function(){

            const workSheet = wb.addWorksheet('Templates - Custom - Contents');
	
			workSheet.columns = generateColumns([
                { header: 'Template ID', width: 32 },
				{ header: 'Template Name', width: 24 },	
                { header: 'Scope', width: 15 },
				{ header: 'Artifact', width: 17 },
                { header: 'Artifact Count', width: 15 },
			]);
            workSheet.autoFilter = { from: 'A1', to: 'N1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                if(instance.templatesCustom) {
                    instance.templatesCustom.forEach(row => {
                        if(row.data && row.data.templates) {
                            var templates = row.data.templates;
    
                            for(var templateId in templates) {
                                var template = templates[templateId];

                                if(template.contents) {
                                    for(var artifact in template.contents) {
                                        workSheet.addRow(generateRowValues(instanceName, instance, [
                                            templateId,
                                            template.name,
                                            template.scope,
                                            artifact,
                                            template.contents[artifact]
                                        ]));
                                    }
                                }                                
                            }
                        }
                    });
                }
            }

            console.log("Parsed custom template artifacts");

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
            workSheet.autoFilter = { from: 'A1', to: 'L1' };

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
            workSheet.autoFilter = { from: 'A1', to: 'O1' };

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
            workSheet.autoFilter = { from: 'A1', to: 'L1' };

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
            sheet.addRow(["Total # of AES apps created:", overviewData.apps.totalCreated]);
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

    sharedData.loadInstancesAndAccounts()
        .then((instances) => {
            loadAllFiles(instances).then((auditData) => {
                //console.log(auditData);
                writeWorkbook(auditData);
            });           
        });
})();