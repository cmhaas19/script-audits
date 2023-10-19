const path = require('path');
const FileLoader = require('../common/FileLoader.js');
const moment = require("moment");
const Data = require('./common/DataSet.js');
const common = require('./common/common.js');

var parseComponents = (distinct) => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "./audits/seismic-components.csv");

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var components = new Data.DataTable("Custom Components");
            var distinctComponents = {};
            var summary = {};
            var isDistinct = (distinct === true);

            components.columns = [
                'SysID',
                'Name',
                'Category',
                'Scope',
                'Created',
                'Created YYYY-MM'
            ];

            auditData.forEach((row) => { 
                if(row.data && row.data.components) {
                    row.data.components.forEach((c) => {

                        if(c.category == "component") {
                            var isProduction = common.isProductionInstance(row.instance);
                            
                            if(!isDistinct || distinctComponents[c.id] == undefined || (isProduction && distinctComponents[c.id] === false)) {
                                distinctComponents[c.id] = isProduction;
    
                                var component = {
                                    id: c.id,
                                    name: c.name,
                                    category: c.category,
                                    scope: c.scope,
                                    createdOn: c.createdOn,
                                    createdOnMonthYear: moment(c.createdOn).format("YYYY-MM")
                                };
        
                                components.addRow(new Data.DataRow(row.instanceName, row.instance, component));

                                var account = common.getAccount(row.instance);

                                if(summary[account.accountNo] == undefined)
                                    summary[account.accountNo] = { account: account, dataItem: { total: 0, production: 0 } };

                                summary[account.accountNo].dataItem.total++;
                                summary[account.accountNo].dataItem.production += (isProduction ? 1 : 0);
                            }
                        }
                    });
                }
            });

            var dataSet = new Data.DataSet();
            dataSet.addTable(components);

            dataSet.summary.columns = ["Total Custom Components", "Custom Components - Production"];
            
            for(var accountNo in summary) {
                dataSet.summary.addSummaryRow(summary[accountNo].account, summary[accountNo].dataItem);
            }

            resolve(dataSet);
        });
    });

    return promise;
};

exports.getComponents = parseComponents;