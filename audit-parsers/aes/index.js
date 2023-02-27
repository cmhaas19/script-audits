
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require('moment');
const fs = require('fs');

var TEMPLATE_NAMES = {};

const AES_VERSIONS = {
    "1.0.6": 106,
    "1.1.1": 111,
    "20.0.1": 2001,
    "20.1.0": 2010,
    "20.1.1": 2011,
    "20.2.2": 2022,
    "21.0.1": 2101,
    "21.1.3": 2113,
    "22.0.3": 2203,
    "23.0.2": 2302
};


var parseCsvFile = (propertyName, auditData) => {
    var promise = new Promise((resolve, reject) => { 
        var fileName = "./audit-files/" + propertyName + ".csv";

        FileLoader.parseCsvFile(fileName).then((data) => {
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
                var missingAccountInfo = 0;

                //
                // Combine all results into one JSON object
                //
                for(var propertyName in auditData){
                    auditData[propertyName].forEach((row) => {
                        var instanceName = row.instanceName;

                        // 
                        // Only include if instance & account info actually exists
                        //
                        if(instances[instanceName] && instances[instanceName].account && instances[instanceName].account.accountName.length){
                            if(combined[instanceName] == undefined)
                                combined[instanceName] = {};

                            if(combined[instanceName][propertyName] == undefined)
                                combined[instanceName][propertyName] = [];
                            
                            combined[instanceName][propertyName].push(row);

                        } else {
                            missingAccountInfo++;
                        }
                    });
                }

                console.log(`Could not locate account info for ${missingAccountInfo} instances`);

                //
                // Now add the account info
                //
                for(var instanceName in combined) {
                    var instance = combined[instanceName];

                    if(instances[instanceName]){
                        instance.instanceInfo = instances[instanceName];
                    }
                }

                
                /* fs.writeFile('aes.json', JSON.stringify(combined, null, 2), () => {
                    console.log("Logged json to aes.json file");
                    resolve(combined);
                });  */
               
                resolve(combined);
            });
	});

	return promise;
};

var populateTemplateNames = (auditData) => {
    var templateNames = {};

    //
    // Need to track all the names found for the given template ID
    // These names can be different (either changed by ServiceNow or by the customer)
    // We'll track how many instances of each name we find and then at the end, we'll only pick the most common
    //
    var parseTemplateNames = (templates) => {
        if(templates) {
            for(var templateId in templates) {
                var templateInstance = templates[templateId];
                var templateName = templateInstance.templateName;

                if(templateName && templateName.length && templateName.indexOf("?") == -1) {
                    if(templateNames[templateId] == undefined)
                        templateNames[templateId] = {};

                    if(templateNames[templateId][templateName] == undefined)
                        templateNames[templateId][templateName] = 0;

                    templateNames[templateId][templateName]++;
                }
            }
        }
    };

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.templates) {
            instance.templates.forEach(row => {
                if(row.data && row.data.currentLanguage === "en") {
                    parseTemplateNames(row.data.appTemplates);
                    parseTemplateNames(row.data.objectTemplates);
                }
            });                
        }
    }

    //
    // Find and store the most common names
    //
    for(var id in templateNames) {
        var highestCount = 0;
        var highestCountName = "";
        
        for(var name in templateNames[id]) {
            var count = templateNames[id][name];
            if(count > highestCount) {
                highestCount = count;
                highestCountName = name;
            }
        }

        TEMPLATE_NAMES[id] = highestCountName;
    }

    //
    // For fun, write out the final list so we can take a peek
    //
    fs.writeFile('templates.json', JSON.stringify(TEMPLATE_NAMES, null, 2), () => {
        console.log("Logged json to templates.json file");
    });
};

var writeGeneralWorksheet = (workbook, auditData) => {

    var worksheet = workbook.addWorksheet("General");
    worksheet.setStandardColumns([
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

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.settings) {
            instance.settings.forEach(row => {

                if(row.data) {
                    var result = {
                        oracleDb: (instance.instanceInfo != undefined ? instance.instanceInfo.usesOracle : false),
                        licensed: row.data.installationDetails.licensed,
                        installed: row.data.installationDetails.installed,
                        installedOn: row.data.installationDetails.installedOn,
                        installedOnYearMonth: "",
                        version: row.data.installationDetails.version,
                        guidedSetupStatus: "",
                        guidedSetupProgress: 0,
                        polarisEnabled: "",
                        legacyWorkspaceEnabled: row.data.legacyWorkspaceEnabled
                    };

                    if(row.data.installationDetails.installed && row.data.installationDetails.installedOn)
                        result.installedOnYearMonth = moment(row.data.installationDetails.installedOn).format("YYYY-MM");

                    if(row.data.guidedSetupStatus && row.data.guidedSetupStatus.status){
                        result.guidedSetupStatus = row.data.guidedSetupStatus.status;
                        result.guidedSetupProgress = parseInt(row.data.guidedSetupStatus.progress);
                    }

                    if(row.data.polarisSettings)
                        result.polarisEnabled = row.data.polarisSettings["glide.ui.polaris.experience"].toString().toLowerCase();

                    worksheet.addStandardRow(instanceName, instance, result);
                }                
            });
        }
    }
};

var writeCustomerWorksheet = (workbook, auditData) => {
    var customers = {};

    //
    // Loop through entire data set and ensure we get one customer record for
    // each account and that record reflects the latest AES installed version and install date
    //
    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.settings) {
            instance.settings.forEach(row => {

                if(row.data && row.data.installationDetails && row.data.installationDetails.installed === true) {
                    var details = row.data.installationDetails;
                    var account = instance.instanceInfo.account;
                    var accountNo = account.accountNo;
                    var customer = customers[accountNo];

                    if(customer == undefined) {
                        customers[accountNo] = {
                            account: account,
                            installedOn: details.installedOn, 
                            installedVersion: {
                                number: AES_VERSIONS[details.version],
                                text: details.version
                            }
                        }
                    } else {
                        if(customer.installedVersion.number < AES_VERSIONS[details.version]) {
                            customer.installedVersion.number = AES_VERSIONS[details.version];
                            customer.installedVersion.text = details.version;
                        }
    
                        if(moment(details.installedOn).isBefore(customer.installedOn)){
                            customer.installedOn = details.installedOn;
                        }
                    }
                }                
            });
        }
    }

    //
    // Now we have our flat customer data set, create the worksheet
    //
    var worksheet = workbook.addWorksheet("Customers");
    worksheet.setAccountColumns([
        { header: 'AES Installed On', width: 17 },
        { header: 'AES Installed On YYYY-MM', width: 12 },
        { header: 'AES Version', width: 17 }
    ]);

    for(var accountNo in customers) {
        var customer = customers[accountNo];
        var account = customer.account;

        var row = {
            installedOn: customer.installedOn, 
            installedOnYearMonth: moment(customer.installedOn).format("YYYY-MM"),
            installedVersion: customer.installedVersion.text
        }
        worksheet.addAccountRow(account, row);
    }
};

var writeAppUsageWorksheetMAU = (workbook, auditData) => {
    var worksheet = workbook.addWorksheet("App Usage - Instances");
    worksheet.setStandardColumns([
        { header: 'Application', width: 14 },
        { header: 'Month', width: 8 },
        { header: 'No. of Users', width: 12 }
    ]);

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.settings) {
            instance.settings.forEach(row => {
                if(row.data && row.data.applicationUsage) {
                    for(var appName in row.data.applicationUsage){
                        var app = row.data.applicationUsage[appName];

                        for(var month in app){
                            var result = {
                                appName: appName,
                                month: month,
                                users: parseInt(app[month])
                            };
                            worksheet.addStandardRow(instanceName, instance, result);
                        }
                    }
                }
            });
        }
    }
};

var writeAppUsageWorksheetMAC = (workbook, auditData) => {
    var accounts = {};

    for(var instanceName in auditData){
        var instance = auditData[instanceName];
        var instanceInfo = instance.instanceInfo;

        if(instanceInfo.account && instanceInfo.account.accountNo && instance.settings) {
            instance.settings.forEach(row => {
                if(row.data && row.data.applicationUsage) {
                    for(var appName in row.data.applicationUsage){
                        var app = row.data.applicationUsage[appName];
                        var accountNo = instanceInfo.account.accountNo;

                        if(accounts[accountNo] == undefined)
                            accounts[accountNo] = { accountInfo: instanceInfo.account, apps: {} };

                        if(accounts[accountNo].apps[appName] == undefined)
                            accounts[accountNo].apps[appName] = {};

                        for(var month in app){
                            if(accounts[accountNo].apps[appName][month] == undefined)
                                accounts[accountNo].apps[appName][month] = 0;

                            accounts[accountNo].apps[appName][month] += parseInt(app[month]);
                        }
                    }
                }
            });
        }
    }

    var worksheet = workbook.addWorksheet("App Usage - Customers");
    worksheet.setColumns([
        { header: 'Company', width: 14 },
        { header: 'Account No', width: 14 },
        { header: 'Account Type', width: 14 },
        { header: 'App Engine Subscriber', width: 14 },
        { header: 'Application', width: 14 },
        { header: 'Month', width: 8 },
        { header: 'No. of Users', width: 12 }
    ]);

    for(var accountNo in accounts) {
        for(var appName in accounts[accountNo].apps) {
            for(var month in accounts[accountNo].apps[appName]) {
                var result = {
                    company: accounts[accountNo].accountInfo.accountName,
                    accountNo: accountNo,
                    accountType: accounts[accountNo].accountInfo.accountType,
                    appEngineSubscriber: accounts[accountNo].accountInfo.isAppEngineSubscriber,
                    appName,
                    month,
                    users: accounts[accountNo].apps[appName][month]
                };

                worksheet.addRow(result);
            }
        }
    }
};


var writeCustomAppsWorksheet = (workbook, auditData) => {

    //
    // Since an app can exist on multiple instances and also as a sys_app on one instance
    // and a sys_store_app on others, we're going to aggregate them all together first to eliminate dups
    //
    var combinedApps = {};

    for(var instanceName in auditData){
        var instance = auditData[instanceName];
        var instanceInfo = instance.instanceInfo;
        var isProduction = (instanceInfo.purpose == "Production");

        // Aggregate sys_apps
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

        // Now aggregate sys_store_apps
        if(instance.storeApps) {
            instance.storeApps.forEach((row) => {
                if(row.data && row.data.storeApps) {
                    for(var id in row.data.storeApps) {
                        var installedOn = row.data.storeApps[id];

                        if(combinedApps[id] == undefined) {
                            combinedApps[id] = {
                                instanceInfo: instanceInfo,
                                isProduction: isProduction
                            };
                        } 

                        combinedApps[id].installedOn = installedOn;

                        if(!combinedApps[id].isProduction)
                            combinedApps[id].isProduction = isProduction;
                    }
                }
            });
        }

        // Now go through all the apps built from templates (they may or may not exist)
        if(instance.templateApps) {
            instance.templateApps.forEach((row) => {
                if(row.data && row.data.aesApps && row.data.aesApps.apps) {
                    var templateLookup = row.data.aesApps.templates;

                    for(var id in row.data.aesApps.apps) {
                        var templateKey = row.data.aesApps.apps[id];
                        var templateId = templateLookup[templateKey];

                        if(combinedApps[id] == undefined) {
                            combinedApps[id] = {
                                instanceInfo: instanceInfo,
                                isProduction: false
                            };
                        }

                        combinedApps[id].templateId = templateId;
                    }

                    if(row.data.aesAppsCount > 750) {
                        console.log(instanceName + " created " + row.data.aesAppsCount + " AES apps");
                    }
                }
            });
        }
    }

    // Now that we have one result set for all custom apps, let's create the worksheet
    var worksheet = workbook.addWorksheet("Custom Apps");
    worksheet.setAccountColumns([
        { header: 'Is Production App', width: 33 },
        { header: 'App SysID', width: 33 },
        { header: 'Template ID', width: 32 },
        { header: 'Template Name', width: 25 },
        { header: 'Store App - Installed On', width: 21 },
        { header: 'Store App - Installed On YYYY-MM', width: 28 }
    ]);

    for(var id in combinedApps) {
        var app = combinedApps[id];
        var formattedDate = "";

        if(app.instanceInfo == undefined){
            console.log("Could not find customer info for " + id);
            continue;
        }
            
        if(app.installedOn && app.installedOn.length) {
            formattedDate = moment(app.installedOn, 'YYYY-MM-DD').format("YYYY-MM");
        }

        var row = {
            isProduction: app.isProduction,
            appId: id,
            templateId: app.templateId,
            templateName: TEMPLATE_NAMES[app.templateId],
            installedOn: app.installedOn,
            installedOnYearMonth: (formattedDate == "Invalid date" ? "" : formattedDate)
        };
        
        worksheet.addAccountRow(app.instanceInfo.account, row);
    }

    return combinedApps;
};

var writeCustomAppAggregatesWorksheet = (workbook, auditData) => {
    var worksheet = workbook.addWorksheet("Custom App Aggregates");
    worksheet.setStandardColumns([
        { header: 'Month', width: 10 },
        { header: '# of Apps', width: 12 }
    ]);

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.customAppsAggregates) {
            instance.customAppsAggregates.forEach(row => {
                if(row.data && row.data.appsByCreatedDate) {
                    for(var month in row.data.appsByCreatedDate) {

                        var result = {
                            month: moment(month, 'MM/YYYY').format("YYYY-MM"),
                            countOfApps: row.data.appsByCreatedDate[month]
                        };

                        worksheet.addStandardRow(instanceName, instance, result);
                    }
                }
            });
        }
    }
};

var writeTemplateWorksheets = (workbook, auditData) => {
    var CUSTOM_TEMPLATE_IDs = {};
    var customWorksheet = workbook.addWorksheet('Templates - Custom');
    var artifactWorksheet = workbook.addWorksheet('Templates - Custom - Contents');
    var installedWorksheet = workbook.addWorksheet('Templates - Installed');
    var usageWorksheet = workbook.addWorksheet('Templates - Usage');

    customWorksheet.setStandardColumns([
        { header: 'Template ID', width: 32 },
        { header: 'Template Name', width: 24 },	
        { header: 'Type', width: 24 },	
        { header: 'Active', width: 15 },			
        { header: 'Scope', width: 15 },
        { header: 'Created On', width: 17 },
        { header: 'Created On YYYY-MM', width: 28 }
    ]);

    artifactWorksheet.setStandardColumns([
        { header: 'Template ID', width: 32 },
        { header: 'Template Name', width: 24 },	
        { header: 'Scope', width: 15 },
        { header: 'Artifact', width: 17 },
        { header: 'Artifact Count', width: 15 }
    ]);

    installedWorksheet.setStandardColumns([
        { header: 'Template ID', width: 32 },
        { header: 'Template Name', width: 24 },	
        { header: 'Active', width: 15 },
        { header: 'Is App Template', width: 15 },
        { header: 'Is Custom Template', width: 15 },
        { header: 'Is Snapshot', width: 15 },
        { header: 'Scope', width: 15 },
        { header: 'Type', width: 15 },
        { header: 'Created On', width: 17 },
        { header: 'Created On YYYY-MM', width: 28 }
    ]);

    usageWorksheet.setStandardColumns([
        { header: 'Template Name', width: 24 },
        { header: 'Template ID', width: 32 },
        { header: 'Is App Template', width: 15 },
        { header: 'Is Custom Template', width: 15 },
        { header: 'Month', width: 17 },
        { header: 'Count', width: 11, alignment: { horizontal: 'right' } }
    ]);

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        //
        // Custom Templates & Custom Template Contents
        //
        if(instance.templatesCustom) {
            instance.templatesCustom.forEach(row => {
                if(row.data && row.data.templates) {
                    var templates = row.data.templates;

                    for(var templateId in templates) {
                        var template = templates[templateId];

                        // Store the ID so we can look it up in template usage to identify custom templates
                        CUSTOM_TEMPLATE_IDs[templateId] = true;

                        customWorksheet.addStandardRow(instanceName, instance, {
                            templateId: templateId,
                            templateName: template.name,
                            templateType: template.type,
                            active: template.active,
                            scope: template.scope,
                            createdOn: template.createdOn,
                            createdOnYearMonth: moment(template.createdOn, 'YYYY-MM-DD').format("YYYY-MM")
                        });

                        if(template.contents) {
                            for(var artifact in template.contents) {
                                artifactWorksheet.addStandardRow(instanceName, instance, {
                                    id: templateId,
                                    name: template.name,
                                    scope: template.scope,
                                    artifact,
                                    countOfApps: template.contents[artifact]
                                });
                            }
                        } 
                    }
                }
            });
        }

        //
        // Installed Templates
        //
        if(instance.templatesInstalled) {
            instance.templatesInstalled.forEach(row => {
                if(row.data && row.data.installedTemplates) {
                    var templates = row.data.installedTemplates;

                    for(var templateId in templates) {
                        var template = templates[templateId];

                        installedWorksheet.addStandardRow(instanceName, instance, {
                            id: templateId,
                            name: template.name,
                            active: template.active,
                            isApp: template.isApp,
                            isCustom: (CUSTOM_TEMPLATE_IDs[templateId] != undefined),
                            snapshot: template.snapshot,
                            scope: template.scope,
                            type: template.type,
                            createdOn: template.createdOn,
                            createdOnYearMonth: moment(template.createdOn, 'YYYY-MM-DD').format("YYYY-MM")
                        });
                    }
                }
            });
        }

        //
        // Template Usage
        // 
        if(instance.templates) {
            instance.templates.forEach(row => {

                //
                // App Templates
                //
                if(row.data && row.data.appTemplates) {
                    var templates = row.data.appTemplates;

                    for(var templateId in templates) {
                        var template = templates[templateId];
                        var templateName = TEMPLATE_NAMES[templateId];

                        for(var month in template.months) {
                            var count = parseInt(template.months[month]);
                            //overviewData.apps.totalCreated += count;

                            usageWorksheet.addStandardRow(instanceName, instance, {
                                templateName,
                                templateId,
                                isAppTemplate: true,
                                isCustom: (CUSTOM_TEMPLATE_IDs[templateId] != undefined),
                                month: moment(month, 'MM/YYYY').format("YYYY-MM"),
                                count
                            });
                        }
                    }
                }

                //
                // Object Templates
                //
                if(row.data && row.data.objectTemplates) {
                    var templates = row.data.objectTemplates;

                    for(var templateId in templates) {
                        var template = templates[templateId];
                        var templateName = TEMPLATE_NAMES[templateId];

                        for(var month in template.months) {
                            var count = parseInt(template.months[month]);

                            usageWorksheet.addStandardRow(instanceName, instance, {
                                templateName,
                                templateId,
                                isAppTemplate: false,
                                isCustom: (CUSTOM_TEMPLATE_IDs[templateId] != undefined),
                                month: moment(month, 'MM/YYYY').format("YYYY-MM"),
                                count
                            });
                        }
                    }
                }
            });
        }
    }
};

var writeAppArtifactsWorksheets = (workbook, auditData) => {
    var worksheet = workbook.addWorksheet('AES App Artifacts');
	
    worksheet.setStandardColumns([
        { header: 'Artifact', width: 41 },
        { header: 'No. of artifacts across all apps', width: 26 },
        { header: 'No. of apps w/ artifact', width: 20 }
    ]);

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.artifacts) {
            instance.artifacts.forEach(row => {
                if(row.data && row.data.appArtifacts) {
                    for(var artifactName in row.data.appArtifacts){
                        var artifact = row.data.appArtifacts[artifactName];

                        worksheet.addStandardRow(instanceName, instance, {
                            artifactName,
                            count: artifact.totalCount,
                            apps: artifact.apps
                        });
                    }
                }
            });
        }
    }
};

var writeRolesWorksheets = (workbook, auditData) => {
    var worksheet = workbook.addWorksheet('Role Counts');
	
    worksheet.setStandardColumns([
        { header: 'AES - Total', width: 11 },
        { header: 'AES - Logged in <= 30 days', width: 22 },
        { header: 'AES - Logged in <= 90 days', width: 22 },
        { header: 'Delegated Dev - Total', width: 19 },
        { header: 'Delegated Dev - Logged in <= 30 days', width: 31 },
        { header: 'Delegated Dev - Logged in <= 90 days', width: 31 },
    ]);

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.roles) {
            instance.roles.forEach(row => {
                if(row.data && row.data.developerRoles && row.data.developerRoles.aesUsers) {
                    var aesUsers = row.data.developerRoles.aesUsers;
                    var delegatedUsers = row.data.developerRoles.delegatedDevelopers;

                    worksheet.addStandardRow(instanceName, instance, {
                        aesUsersTotal: aesUsers.total, 
                        aesUsers30: aesUsers["30"],
                        aesUsers90: aesUsers["90"], 
                        delegatedUsersTotal: delegatedUsers.total, 
                        delegatedUsers30: delegatedUsers["30"], 
                        delegatedUsers90: delegatedUsers["90"]
                    });
                }
            });
        }
    }
};

var writeErrorsWorksheets = (workbook, auditData) => {
    var worksheet = workbook.addWorksheet('Errors');

    worksheet.setStandardColumns([
        { header: 'Audit', width: 8 },
        { header: 'Audit State', width: 12 },
        { header: 'Error Description', width: 42 }
    ]);

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        for(var auditName in instance) {
            var audit = instance[auditName];

            if(Array.isArray(audit)){
                audit.forEach((row) => {

                    if(!row.success && instanceName != "Instance Name" && instanceName != "u_instance_name") {
                        worksheet.addStandardRow(instanceName, instance, {
                            auditName, 
                            auditState: row.auditState, 
                            errorDescription: row.errorDescription
                        });
                    }
                });
            }
        }
    }
};

var writeOverviewWorksheet = (worksheet, auditData, customApps) => {

    var fileDate = fs.statSync("./audit-files/settings.csv").mtime;
    var scanStatuses = { errors: 0, excluded: 0, success: 0 };
    var scanSummary = { totalCustomers: {}, installedCustomers: {}, installedInstances: {} };
    var aesApps = { totalCreated: 0, totalProduction: 0 };

    for(var instanceName in auditData){
        var instance = auditData[instanceName];

        if(instance.settings) {
            instance.settings.forEach(row => {
                if(row.data && row.data.installationDetails) {

                    if(row.data.installationDetails.installed === true) {
                        scanSummary.installedCustomers[instance.instanceInfo.account.accountNo] = true;
                        scanSummary.installedInstances[instanceName] = true;
                    }

                    scanSummary.totalCustomers[instance.instanceInfo.account.accountNo] = true;
                }

                if(!row.success) {
                    switch(row.auditState){
                        case "Failed":
                            scanStatuses.errors++;
                            break;
                        case "Excluded":
                            scanStatuses.excluded++;
                            break;
                    }
                } else {
                    scanStatuses.success++;
                }
            });
        }

        if(instance.templates) {
            instance.templates.forEach(row => {
                if(row.data && row.data.appTemplates) {
                    for(var templateId in row.data.appTemplates) {
                        var template = row.data.appTemplates[templateId];

                        for(var month in template.months) {
                            aesApps.totalCreated += parseInt(template.months[month]);
                        }
                    }
                }
            });
        }
    }

    for(var id in customApps) {
        var app = customApps[id];

        if(app.templateId && app.templateId.length && app.isProduction == true) {
            aesApps.totalProduction++;
        }
    }

    worksheet.setColumns([{ header: '', width: 34 }, { header: '', width: 34 }]);
    worksheet.addTextRow();
    worksheet.addTextRow(["Last updated:", moment(fileDate).format("MMMM Do YYYY, h:mm:ss a")]);
    worksheet.addTextRow();
    worksheet.addTextRow(["No. of Instances Audited Successfully:", scanStatuses.success]);
    worksheet.addTextRow(["No. of Instances Excluded:", scanStatuses.excluded]);
    worksheet.addTextRow(["No. of Instances with Errors:", scanStatuses.errors]);
    worksheet.addTextRow();
    worksheet.addTextRow(["Total customers audited successfully:", Object.keys(scanSummary.totalCustomers).length]);
    worksheet.addTextRow();
    worksheet.addTextRow(["Total AES installs (instances):", Object.keys(scanSummary.installedInstances).length]);
    worksheet.addTextRow(["Total AES installs (customers):", Object.keys(scanSummary.installedCustomers).length]);
    worksheet.addTextRow();
    worksheet.addTextRow(["Total # of AES apps created:", aesApps.totalCreated]);
    worksheet.addTextRow(["Total # of AES apps in production:", aesApps.totalProduction]);

};

(function(){

    FileLoader.loadInstancesAndAccounts()
        .then(loadAllFiles)
        .then((auditData) => {

            var workbook = new Audit.AuditWorkbook("./processed-results.xlsx");
            var overviewWorksheet = workbook.addWorksheet('Overview');

            populateTemplateNames(auditData);
            console.log("Populated Template Names");

            writeGeneralWorksheet(workbook, auditData);
            console.log("Created General Worksheet");

            writeCustomerWorksheet(workbook, auditData);
            console.log("Created Customer Worksheet");

            writeAppUsageWorksheetMAU(workbook, auditData);
            console.log("Created App Usage MAU Worksheet");

            writeAppUsageWorksheetMAC(workbook, auditData);
            console.log("Created App Usage MAC Worksheet");

            var customApps = writeCustomAppsWorksheet(workbook, auditData);
            console.log("Created Custom Apps Worksheet");

            writeCustomAppAggregatesWorksheet(workbook, auditData);
            console.log("Created Custom App Aggregates Worksheet");

            writeTemplateWorksheets(workbook, auditData);
            console.log("Created Template Worksheets");

            writeAppArtifactsWorksheets(workbook, auditData);
            console.log("Created App Artifacts Worksheet");

            writeRolesWorksheets(workbook, auditData);
            console.log("Created Roles Worksheet");

            writeErrorsWorksheets(workbook, auditData);
            console.log("Created Errors Worksheet");

            writeOverviewWorksheet(overviewWorksheet, auditData, customApps);
            console.log("Created Overview Worksheet");

            workbook.commit().then(() => console.log("Finished!"));
        });

})();