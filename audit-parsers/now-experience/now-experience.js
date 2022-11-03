const path = require('path');
const FileLoader = require('../common/FileLoader.js');
const moment = require("moment");
const Data = require('./common/DataSet.js');
const common = require('./common/common.js');


var EXCLUDED_EXPERIENCES = {
    "2cbe185e0fb12010d620d55566767e33":"Adoption Services",
    "096bd1fb0fc32010d620d55566767e85":"Adoption Services Builder",
    "ad03e8565392101057f1ddeeff7b125a":"IntegrationHub Studio",
    "a84adaf4c700201072b211d4d8c260b7": "Unified Navigation App",
    "b409e647076320105fca5d1aead30099": "ATF Unified Nav",
    "3fb0e735530130106796ddeeff7b1260": "Flow Template",
    "e6bb67925b21201058eefe3dda81c79f": "Export pages",
    "fd5428035b632010a12068aa3d81c7ca": "export to pdf"
};

var EXCLUDED_ADMIN_PANEL_TABLES = {
    "sys_aw_master_config": "Legacy Agent Workspace"
};

var parseNowExperiences = (distinct) => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "audits/now-experiences.csv");
        var experienceColumns = [
            'SysID',
            'Title',
            'URL',
            'Active',
            'Scope',
            'Created',
            'Created YYYY-MM',
            'Updated',
            'Updated YYYY-MM',
            'Admin Panel ID',
            'Admin Panel Table',
            'Admin Panel Name',
            'Admin Panel Landing Path',
            'Admin Panel App Routes Count',
            'App Shell ID',
            'App Shell Name',
            'App Shell Category',
            'App Shell Extends ID',
            'App Shell Extends Name'
        ];

        var routeColumns = [
            'Experience ID',
            'Admin Panel ID',
            'Admin Panel Table',
            'Admin Panel Name',
            'App Shell ID',
            'App Shell Name',
            'App Route',
        ];

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var dataSet = new Data.DataSet();
            var experiences = new Data.DataTable("Experiences");
            var routes = new Data.DataTable("Experience Routes");
            var summary = { };

            experiences.columns = experienceColumns;
            routes.columns = routeColumns;

            var distinctExperienceIds = {};
            var isDistinct = (distinct === true);

            auditData.forEach((row) => {

                if(row.data && row.data.experiences) {
                    var isProduction = common.isProductionInstance(row.instance);

                    for(var id in row.data.experiences) {
                        var ex = row.data.experiences[id];

                        if(EXCLUDED_EXPERIENCES[id] != undefined)
                            continue;

                        if(ex.adminPanel && EXCLUDED_ADMIN_PANEL_TABLES[ex.adminPanel.table] != undefined)
                            continue;
                        
                        if(isDistinct && (distinctExperienceIds[id] != undefined || (isProduction && distinctExperienceIds[id] === false)))
                           continue;

                        distinctExperienceIds[id] = isProduction;

                        var experience = {
                            id: id,
                            title: ex.title,
                            url: ex.url,
                            active: ex.active,
                            scope: ex.scope,
                            createdOn: ex.createdOn,
                            createdOnMonthYear: moment(ex.createdOn).format("YYYY-MM"),
                            updatedOn: ex.updatedOn,
                            updatedOnMonthYear: moment(ex.updatedOn).format("YYYY-MM"),
                            adminPanelId: (ex.adminPanel != undefined ? ex.adminPanel.id : ""),
                            adminPanelTable: (ex.adminPanel != undefined ? ex.adminPanel.table : ""),
                            adminPanelName: (ex.adminPanel != undefined ? ex.adminPanel.name : ""),
                            adminPanelLandingPath: (ex.adminPanel != undefined ? ex.adminPanel.landingPath : ""),
                            adminPanelAppRoutesCount: (ex.adminPanel != undefined ?  ex.adminPanel.appRoutes.length : 0),
                            appShellId: (ex.appShell != undefined ?  ex.appShell.id : ""),
                            appShellName: (ex.appShell != undefined ?  ex.appShell.name : ""),
                            appShellCategory: (ex.appShell != undefined ?  ex.appShell.category : ""),
                            appShellExtendsId: (ex.appShell != undefined ?  ex.appShell.extendsId : ""),
                            appShellExtendsName: (ex.appShell != undefined ?  ex.appShell.extendsName : "")
                        };

                        if(ex.adminPanel && ex.adminPanel.appRoutes && ex.adminPanel.appRoutes.length) {
                            ex.adminPanel.appRoutes.forEach((route) => routes.addRow(new Data.DataRow(row.instanceName, row.instance, {
                                id: experience.id,
                                adminPanelId: experience.adminPanelId,
                                adminPanelTable: experience.adminPanelTable,
                                adminPanelName: experience.adminPanelName,
                                appShellId: experience.appShellId,
                                appShellName: experience.appShellName,
                                route
                            })));
                        }

                        experiences.addRow(new Data.DataRow(row.instanceName, row.instance, experience));

                        var account = common.getAccount(row.instance);

                        if(summary[account.accountNo] == undefined)
                            summary[account.accountNo] = { account: account, dataItem: { total: 0, production: 0 } };

                        summary[account.accountNo].dataItem.total++;
                        summary[account.accountNo].dataItem.production += (isProduction ? 1 : 0);
                    }
                }
            });
            
            dataSet.addTable(experiences);
            dataSet.addTable(routes);

            dataSet.summary.columns = ["Total Now Experiences", "Now Experiences - Production"];
            
            for(var accountNo in summary) {
                dataSet.summary.addSummaryRow(summary[accountNo].account, summary[accountNo].dataItem);
            }

            resolve(dataSet);

        });
    });

    return promise;
};

exports.getExperiences = parseNowExperiences;