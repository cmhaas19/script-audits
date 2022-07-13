const path = require('path');
const sharedData = require('../shared/shared');
const moment = require("moment");
const Data = require('./common/DataSet.js');
const common = require('./common/common.js');

var parseComponents = (distinct) => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "./audits/seismic-components.csv");

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
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
                'Created YYYY-MM',
                'Updated',
                'Updated YYYY-MM'
            ];

            auditData.forEach((row) => { 
                if(row.data && row.data.components && row.data.components.sys_ux_macroponent) {
                    row.data.components.sys_ux_macroponent.forEach((c) => {

                        if(c.category == "component") {
                            var isProduction = common.isProductionInstance(row.instance);
                            
                            if(!isDistinct || distinctComponents[c.sys_id] == undefined || (isProduction && distinctComponents[c.sys_id] === false)) {
                                distinctComponents[c.sys_id] = isProduction;
    
                                var component = {
                                    id: c.sys_id,
                                    name: c.name,
                                    category: c.category,
                                    scope: c.sys_scope,
                                    createdOn: c.sys_created_on,
                                    createdOnMonthYear: moment(c.sys_created_on).format("YYYY-MM"),
                                    updatedOn: c.sys_updated_on,
                                    updatedOnMonthYear: moment(c.sys_updated_on).format("YYYY-MM")
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