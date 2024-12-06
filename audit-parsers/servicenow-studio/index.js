
const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require("moment");

var writeGeneralWorksheet = (workbook, auditData) => {

    var worksheet = workbook.addWorksheet("General");
    worksheet.setStandardColumns([
        { header: 'Installed', width: 13 },
        { header: 'Installed On', width: 17 },
        { header: 'Installed On YYYY-MM', width: 12 },
        { header: 'Version', width: 17 },
        { header: 'Total Admins', width: 20 },
        { header: 'Total Delegated Devs', width: 20 },
        { header: 'Total Users', width: 20 },
        { header: 'Total ServiceNow Studio Apps', width: 20 },
        { header: 'Total Custom Apps', width: 20 },
        //{ header: 'Total Processes', width: 20 },
        //{ header: 'Total Records', width: 20 },
        //{ header: 'Total Fulfillers', width: 20 },
        { header: 'Pipeline Installed', width: 20 },
        { header: 'Pipelines - Total', width: 20 },
        { header: 'Pipelines - Total Environments', width: 30 }
    ]);

    auditData.forEach((row) => {
        if(row.data) {
            var result = {
                installed: row.data.installationDetails.installed,
                installedOn: row.data.installationDetails.installedOn,
                installedOnYearMonth: "",
                version: row.data.installationDetails.version,
                admins: 0,
                delegatedDevs: 0,
                totalUsers: 0,
                snsApps: 0,
                totalApps: 0,
                pipelineInstalled: row.data.pipelineStats.installed,
                pipelineCount: row.data.pipelineStats.totalPipelines,
                environmentCount: row.data.pipelineStats.totalEnvironments
            };

            if(row.data.userRoleCounts) {
                result.admins = (row.data.userRoleCounts.admin != undefined ? row.data.userRoleCounts.admin : 0);
                result.delegatedDevs = (row.data.userRoleCounts.delegated_developer != undefined ? row.data.userRoleCounts.delegated_developer : 0);
                result.totalUsers = result.admins + result.delegatedDevs;
            }

            if(row.data.appCounts) {
                for(var ide in row.data.appCounts) {
                    result.totalApps += row.data.appCounts[ide];

                    if(ide == "SNS") {
                        result.snsApps = row.data.appCounts[ide];
                    }
                }
            }

            if(row.data.installationDetails.installed && row.data.installationDetails.installedOn)
                result.installedOnYearMonth = moment(row.data.installationDetails.installedOn).format("YYYY-MM");

            worksheet.addStandardRow(row.instanceName, row.instance, result);
        }
    });
};

var writeCustomerWorksheet = (workbook, auditData) => {
    var customers = {};

    var getNumericVersion = (version) => {
        var value = 0;

        if(version != null && version != undefined && version.length > 0){
            value = parseInt(version.replace(/\D/g, ''));

            if(isNaN(value))
                value = 0;
        }

        return value;
    };

    //
    // Loop through entire data set and ensure we get one customer record for
    // each account and that record reflects the latest installed version and install date
    //
    auditData.forEach((row) => {
        if(row.data && row.data.installationDetails && row.data.installationDetails.installed === true) {
            var details = row.data.installationDetails;
            var account = row.instance.account;
            var accountNo = account.accountNo;
            var customer = customers[accountNo];

            var numericVersion = getNumericVersion(details.version);

            if(customer == undefined) {
                customers[accountNo] = {
                    account: account,
                    installedOn: details.installedOn,
                    installedVersion: {
                        number: numericVersion,
                        text: details.version
                    }
                }
            } else {
                if(customer.installedVersion.number < numericVersion) {
                    customer.installedVersion.number = numericVersion;
                    customer.installedVersion.text = details.version;
                }

                if(moment(details.installedOn).isBefore(customer.installedOn)){
                    customer.installedOn = details.installedOn;
                }
            }
        }
    });

    //
    // Now we have our flat customer data set, create the worksheet
    //
    var worksheet = workbook.addWorksheet("Customers");
    worksheet.setAccountColumns([
        { header: 'Installed On', width: 17 },
        { header: 'Installed On YYYY-MM', width: 12 },
        { header: 'Version', width: 17 }
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

    auditData.forEach((row) => {
        if(row.data && row.data.applicationUsage) {
            for(var appName in row.data.applicationUsage){
                var app = row.data.applicationUsage[appName];

                for(var month in app){
                    var result = {
                        appName: appName,
                        month: month,
                        users: parseInt(app[month])
                    };
                    worksheet.addStandardRow(row.instanceName, row.instance, result);
                }
            }
        }
    });
};

var writeAppUsageWorksheetMAC = (workbook, auditData) => {
    var accounts = {};

    auditData.forEach((row) => {
        if(row.data && row.data.applicationUsage) {
            for(var appName in row.data.applicationUsage){
                var app = row.data.applicationUsage[appName];
                var account = row.instance.account;
                var accountNo = row.instance.account.accountNo;

                if(accounts[accountNo] == undefined)
                    accounts[accountNo] = { accountInfo: account, apps: {} };

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

var writeBookmarksData = (workbook, auditData) => {
    var worksheet = workbook.addWorksheet("Bookmarks");

    worksheet.setColumns([
        { header: 'Instance Name', width: 20 },
        { header: 'Company', width: 20 },
        { header: 'Account No', width: 20 },
        { header: 'Instance Purpose', width: 20 },
        { header: 'Bookmark Type', width: 20 },
        { header: 'File Type', width: 20 },
        { header: 'No. of Users', width: 15 },
        { header: 'No. of Bookmarks', width: 15 }
    ]);

    auditData.forEach((row) => {
        if(row.data && row.data.bookmarks && Object.keys(row.data.bookmarks).length > 0) {

            for(var fileType in row.data.bookmarks){
                var fileTypeData = row.data.bookmarks[fileType];

                worksheet.addRow({
                    instanceName: row.instanceName,
                    accountName: row.instance.account.accountName,
                    accountNo: row.instance.account.accountNo,
                    purpose: row.instance.purpose,
                    bookmarkType: (fileType == "sys_app" || fileType == "sys_store_app" ? "App" : "File"),
                    fileType: fileType,
                    users: fileTypeData.u,
                    bookmarks: fileTypeData.c
                });
            }
        }
    });
};

var writeFileHistoryData = (workbook, auditData) => {
    var worksheet = workbook.addWorksheet("File History");

    worksheet.setColumns([
        { header: 'Instance Name', width: 20 },
        { header: 'Company', width: 20 },
        { header: 'Account No', width: 20 },
        { header: 'Instance Purpose', width: 20 },
        { header: 'Month', width: 20 },
        { header: 'Is App?', width: 20 },
        { header: 'File Type', width: 20 },
        { header: 'No. of Users', width: 15 },
        { header: 'No. Opened', width: 15 }
    ]);

    auditData.forEach((row) => {
        if(row.data && row.data.fileHistory) {
            for(var month in row.data.fileHistory){
                for(var fileTypeName in row.data.fileHistory[month]){
                    var fileType = row.data.fileHistory[month][fileTypeName];

                    worksheet.addRow({
                        instanceName: row.instanceName,
                        accountName: row.instance.account.accountName,
                        accountNo: row.instance.account.accountNo,
                        purpose: row.instance.purpose,
                        month: moment(month, 'MM/YYYY').format("YYYY-MM"),
                        isApp: (fileTypeName == "sys_app" || fileTypeName == "sys_store_app" ? "True" : "False"),
                        fileType: fileTypeName,
                        users: fileType.u,
                        opened: fileType.c
                    });
                }
            }
        }
    });
};

var writeUserPreferences = (workbook, auditData) => {
    var worksheet = workbook.addWorksheet("User Preferences");

    worksheet.setColumns([
        { header: 'Instance Name', width: 20 },
        { header: 'Company', width: 20 },
        { header: 'Account No', width: 20 },
        { header: 'Instance Purpose', width: 20 },
        { header: 'User Preference Key', width: 20 },
        { header: 'User Preference Value', width: 20 },
        { header: 'No. of Users', width: 15 }
    ]);

    auditData.forEach((row) => {
        if(row.data && row.data.userPreferences) {
            for(var key in row.data.userPreferences){

                var preference = row.data.userPreferences[key];

                for(var values in preference){
                    var value = preference[values];

                    worksheet.addRow({
                        instanceName: row.instanceName,
                        accountName: row.instance.account.accountName,
                        accountNo: row.instance.account.accountNo,
                        purpose: row.instance.purpose,
                        key: key,
                        value: value,
                        users: preference[values]
                    });
                }
            }
        }
    });
};

(function(){

    var fileName = path.join(__dirname, "results.json");       

    FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

        var wb = new Audit.AuditWorkbook("servicenow-studio-audit.xlsx");

        writeGeneralWorksheet(wb, auditData);
        console.log("Created General Worksheet");

        writeCustomerWorksheet(wb, auditData);
        console.log("Created Customer Worksheet");

        writeAppUsageWorksheetMAU(wb, auditData);
        console.log("Created App Usage MAU Worksheet");

        writeAppUsageWorksheetMAC(wb, auditData);
        console.log("Created App Usage MAC Worksheet");

        writeBookmarksData(wb, auditData);
        console.log("Created Bookmarks Worksheet");

        writeFileHistoryData(wb, auditData);
        console.log("Created File History Worksheet");

        writeUserPreferences(wb, auditData);
        console.log("Created User Preferences Worksheet");
        
        wb.commit().then(() => console.log("Finished!"));

    });

})();