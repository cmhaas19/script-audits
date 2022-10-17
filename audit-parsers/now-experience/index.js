
const path = require('path');
const sharedData = require('../shared/shared');
const ExcelJS = require('exceljs');
const moment = require("moment");

var EXCLUDED_EXPERIENCES = {
    "2cbe185e0fb12010d620d55566767e33":"Adoption Services",
    "096bd1fb0fc32010d620d55566767e85":"Adoption Services Builder",
    "ad03e8565392101057f1ddeeff7b125a":"IntegrationHub Studio"
};

var EXCLUDED_PORTALS = {
    "6edeb9a60b032200acc30e7363673a97":"Time Sheet Portal",
    "7295ec370b5003005e93ec3393673a36":"Business Planner Portal",
    "4905e47d93722200ea933007f67ffb2b":"Planning Console",
    "9cfb12e337331200277826877e41f110":"Project Status",
    "2aa3dd63c313120028d7d56bc3d3ae88":"PPS Workbench",
    "fafd2d039370220064f572edb67ffb34":"Resource Workbench",
    "fb5376f793203200ea933007f67ffb5d":"Resource Calendar",
    "8778027753ef10103ad4ddeeff7b129e":"Program Status",
    "e7ba7357b713230011a43d28ee11a951":"Idea portal",
    "a2d4da57932132003706dfa5e57ffb77":"Service Charging",
    "2086b814c3221200f3897bfaa2d3aea8":"Customer Service",
    "a50b1d2bb34033002c992ab716a8dce2":"Domain Separation Center",
    "abd3bc239f13220030581471367fcff3":"Vendor Portal",
    "cd472f7fdbd2674036573ebd7c96190d":"Nuvolo EAM",
    "1dd44a90c3310200b7b87868e1d3aea2":"HR Service Portal"
};

var generateColumns = (values) => {
    var columns = [
        { header: 'Instance Name', width: 22 },
        { header: 'Company', width: 42 },
        { header: 'Account No.', width: 12 },
        { header: 'Account Type', width: 17 },
        { header: 'Primary Rep', width: 22 },
        { header: 'Solution Consultant', width: 23 },
        { header: 'App Engine Subscriber', width: 22 },
        { header: 'Instance Version', width: 22 },
        { header: 'Instance Purpose', width: 16 },
    ];

    return columns.concat(values);
};

var generateRowValues = (instanceName, instance, values) => {
    var rowValues = [];
    //console.log(instance);

    if(instance && instance.account) {
        var account = instance.account;
        rowValues = [instanceName, account.accountName, account.accountNo, account.accountType, account.primarySalesRep, account.solutionConsultant, account.isAppEngineSubscriber, instance.version, instance.purpose];
    }                
    else {
        rowValues = [instanceName,"","","","","","","",""];
    }        

    return rowValues.concat(values);
};

/*
{
   "companyCode":"chri2",
   "currentLanguage":"es",
   "experiences":{
      "2cbe185e0fb12010d620d55566767e33":{
         "title":"Adoption Services",
         "url":"adoptionservices",
         "active":true,
         "createdOn":"2021-01-21 05:13:09",
         "updatedOn":"2021-01-25 09:03:12",
         "adminPanel":{
            "id":"4bfe585e0fb12010d620d55566767eae",
            "table":"sys_ux_app_config",
            "name":"Adoption Services",
            "landingPath":"home",
            "appRoutes":[
               "Home"
            ]
         },
         "appShell":{
            "id":"c276387cc331101080d6d3658940ddd2",
            "name":"Agent Workspace App Shell",
            "category":"IU de shell de aplicaciÛn",
            "extendsId":"fee17a0f5b130010b913cbd59b81c7c2",
            "extendsName":"UXR Blank AppShell"
         }
      }
   }
}
*/
var processTemplateScopes = () => {

    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "audits/now-experiences-from-templates.csv");

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var scopes = {};

            auditData.forEach((row) => {
                if(row.data && row.data.templateExperiences && row.data.templateExperiences.length > 0) {
                    row.data.templateExperiences.forEach((scope) => {
                        scopes[scope] = true;
                    });
                }
            });

            console.log("Found " + Object.keys(scopes).length + " AES scopes");

            resolve(scopes);
        });
    });;

    return promise;
}

var processNowExperiences = (AES_SCOPES) => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "now-experiences-results.xlsx"
        });

        var fileName = path.join(__dirname, "audits/now-experiences.csv");       

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var generalWs = wb.addWorksheet("Now Experiences");
            var routesWs = wb.addWorksheet("Now Experiences - Routes");
    
            generalWs.columns = generateColumns([
                { header: 'SysID', width: 20 },
                { header: 'Title', width: 20 },
                { header: 'URL', width: 20 },
                { header: 'Active', width: 20 },
                { header: 'Template Generated', width: 20 },
                { header: 'Scope', width: 20 },
                { header: 'Created', width: 20 },
                { header: 'Created YYYY-MM', width: 20 },
                { header: 'Updated', width: 20 },
                { header: 'Updated YYYY-MM', width: 20 },
                { header: 'Admin Panel ID', width: 20 },
                { header: 'Admin Panel Table', width: 20 },
                { header: 'Admin Panel Name', width: 20 },
                { header: 'Admin Panel Landing Path', width: 20 },
                { header: 'Admin Panel App Routes Count', width: 20 },
                { header: 'Admin Panel App Routes', width: 20 },
                { header: 'App Shell ID', width: 20 },
                { header: 'App Shell Name', width: 20 },
                { header: 'App Shell Category', width: 20 },
                { header: 'App Shell Extends ID', width: 20 },
                { header: 'App Shell Extends Name', width: 20 }
            ]);

            routesWs.columns = generateColumns([
                { header: 'Experience ID', width: 20 },
                { header: 'Admin Panel ID', width: 20 },
                { header: 'Admin Panel Table', width: 20 },
                { header: 'Admin Panel Name', width: 20 },
                { header: 'App Shell ID', width: 20 },
                { header: 'App Shell Name', width: 20 },
                { header: 'App Route', width: 20 }
            ]);
            
            auditData.forEach((row) => {

                if(row.data && row.data.experiences) {

                    for(var id in row.data.experiences) {
                        var ex = row.data.experiences[id];

                        if(EXCLUDED_EXPERIENCES[id] != undefined)
                            continue;

                        var values = [
                            id, 
                            ex.title,
                            ex.url,
                            ex.active,
                            (AES_SCOPES[ex.scope] === true),
                            ex.scope,
                            ex.createdOn,
                            moment(ex.createdOn).format("YYYY-MM"),
                            ex.updatedOn,
                            moment(ex.updatedOn).format("YYYY-MM")
                        ];

                        if(ex.adminPanel) {
                            values.push(
                                ex.adminPanel.id,
                                ex.adminPanel.table,
                                ex.adminPanel.name,
                                ex.adminPanel.landingPath,
                                ex.adminPanel.appRoutes,
                                ex.adminPanel.appRoutes.length);
                        } else {
                            values.push("","","","","","");
                        }

                        if(ex.appShell) {
                            values.push(
                                ex.appShell.id,
                                ex.appShell.name,
                                ex.appShell.category,
                                ex.appShell.extendsId,
                                ex.appShell.extendsName);
                        } else {
                            values.push("","","","","");
                        }

                        generalWs.addRow(
                            generateRowValues(row.instanceName, row.instance, values)).commit();

                        if(ex.adminPanel && ex.adminPanel.appRoutes && ex.adminPanel.appRoutes.length) {
                            ex.adminPanel.appRoutes.forEach((route) => {
                                routesWs.addRow(
                                    generateRowValues(row.instanceName, row.instance, [
                                        id,
                                        ex.adminPanel.id,
                                        ex.adminPanel.table,
                                        ex.adminPanel.name,
                                        (ex.appShell != undefined ? ex.appShell.id : ""),
                                        (ex.appShell != undefined ? ex.appShell.name : ""),
                                        route
                                    ]));
                            });
                        }
                    }
                }
            });

            generalWs.commit();
            routesWs.commit();

            wb.commit().then(() => {
                console.log("Processed Now Experiences");
                resolve();
            });
        });
    });

    return promise;
};

/*
    {
   "companyCode":"aaal2",
   "currentLanguage":"en",
   "portals":{
      "2aa3dd63c313120028d7d56bc3d3ae88":{
         "title":"PPS Workbench",
         "urlSuffix":"ppsworkbench",
         "scope":"global",
         "createdOn":"2016-05-16 06:09:31",
         "updatedOn":"2020-03-01 01:03:19"
      }
   }
}
*/



var processCustomComponents = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "seismic-components-results.xlsx"
        });

        var fileName = path.join(__dirname, "audits/seismic-components.csv");

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var tables = ["sys_ux_macroponent","sys_ux_lib_component","sys_uib_toolbox_component","sys_ux_lib_source_script"];

            tables.forEach((table) => {
                var columns = {};

                //
                // Build the column set
                //
                auditData.forEach((row) => { 
                    if(row.data && row.data.components && row.data.components[table]) {
                        var list = row.data.components[table];

                        list.forEach((item) => {
                            Object.keys(item).forEach((key) => {
                                if(columns[key] == undefined)
                                    columns[key] = true;
                            });
                        });
                    }
                });

                //
                // Create worksheet & columns
                //    
                var ws = wb.addWorksheet(table);
                var headers = [];

                for(var column in columns) {
                    headers.push({ header: column, width: 20 });
                }

                ws.columns = generateColumns(headers);

                //
                // Now build the rows
                //
                auditData.forEach((row) => { 
                    if(row.data && row.data.components && row.data.components[table]) {
                        var list = row.data.components[table];
                        
                        list.forEach((item) => {
                            var values = [];

                            for(var column in columns) {
                                values.push(item[column]);
                            }

                            ws.addRow(
                                generateRowValues(row.instanceName, row.instance, values)).commit();
                        });                        
                    }
                });

                ws.commit();
            });

            wb.commit().then(() => {
                console.log("Processed Custom Components");
                resolve();
            });
        });
    });

    return promise;
};

(function(){

    //processTemplateScopes().then(processNowExperiences);
    processPortals();
    //processCustomComponents();

})();