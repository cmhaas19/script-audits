const path = require('path');
const FileLoader = require('../common/FileLoader.js');
const moment = require("moment");
const Data = require('./common/DataSet.js');
const common = require('./common/common.js');

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

var parsePortals = (distinct) => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "./audits/service-portals.csv");       

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var portals = new Data.DataTable("Portals");
            var distinctPortals = {};
            var isDistinct = (distinct === true);
    
            portals.columns = [
                'SysID',
                'Title',
                'URL Suffix',
                'Scope',
                'Created',
                'Created YYYY-MM',
                'Updated',
                'Updated YYYY-MM'
            ];

            var distinctPortals = {};
            var summary = {};

            auditData.forEach((row) => {

                if(row.data && row.data.portals) {
                    var isProduction = common.isProductionInstance(row.instance);

                    for(var id in row.data.portals) {
                        var ex = row.data.portals[id];

                        if(EXCLUDED_PORTALS[id] != undefined)
                            continue;

                        if(isDistinct && (distinctPortals[id] != undefined || (isProduction && distinctPortals[id] === false)))
                            continue;

                        distinctPortals[id] = isProduction;

                        portals.addRow(new Data.DataRow(row.instanceName, row.instance, {
                            id: id,
                            title: ex.title,
                            urlSuffix: ex.urlSuffix,
                            scope: ex.scope,
                            createdOn: ex.createdOn,
                            createdOnMonthYear: moment(ex.createdOn).format("YYYY-MM"),
                            updatedOn: ex.updatedOn,
                            updatedOnMonthYear: moment(ex.updatedOn).format("YYYY-MM")
                        }));

                        var account = common.getAccount(row.instance);

                        if(summary[account.accountNo] == undefined)
                            summary[account.accountNo] = { account: account, dataItem: { total: 0, production: 0 } };

                        summary[account.accountNo].dataItem.total++;
                        summary[account.accountNo].dataItem.production += (isProduction ? 1 : 0);
                    }
                }
            });

            var dataSet = new Data.DataSet();
            dataSet.addTable(portals);

            dataSet.summary.columns = ["Total Service Portals", "Service Portals - Production"];
            
            for(var accountNo in summary) {
                dataSet.summary.addSummaryRow(summary[accountNo].account, summary[accountNo].dataItem);
            }

            resolve(dataSet);
            
        });
    });

    return promise;
};

exports.getPortals = parsePortals;