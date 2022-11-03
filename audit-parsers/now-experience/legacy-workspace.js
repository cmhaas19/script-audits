
const path = require('path');
const FileLoader = require('../common/FileLoader.js');
const moment = require("moment");
const Data = require('./common/DataSet.js');
const common = require('./common/common.js');

const KNOWN_WORKSPACES = {
	"7b24ceae5304130084acddeeff7b12a3": "Agent Workspace",
	"ff23c7f5b30323002a0862ac16a8dcc9": "Service Workspace",
	"6c8d4c7f5364330094fbddeeff7b125f": "HR Workspace",
    "03043934b32300107a6de81816a8dc92": "Business Continuity Workspace",
    "44406e7773003300844489b954f6a797": "Legal Counsel Workspace",
    "b47dea70b3210010ed7fc9c316a8dcf7": "Manager Workspace",
    "1ae69deec7315010d721fff1c7c260b9": "Site Reliability Operations Workspace",
    "3ea49a781b374010aa759608bd4bcb52": "",
    "662124acdbd788902c3e3e1b7c9619e1": "",
    "46e9298f1b019c505b34c99f1d4bcbf9": "",
    "d768624cdb2c541044e9f15aaf9619a0": "",
    "e7607b481b291010f89b99bc1d4bcbd5": "",
    "b854f3ebdb28ec50340ec586059619e4": "",
    "134a42a91bf854d08ec1b802dd4bcb47": "",
    "22864f06db1798102df0c170ba961980": "",
    "767856d7dbc654d49d477ba532961997": "",
    "01f31e931b36a8109b5a11361a4bcbb0": "",
    "431bdcc0db9a4010eb88156039961925": "",
    "2b0179e353720010e7cdddeeff7b12c1": "",
    "72e84efab3b333007a6de81816a8dcbf": "",
    "280747ccdbd19c5093eccef40596195c": "",
    "2ad58ed3dbcd14107b64ed6b4b9619e1": "",
    "39069bc9db3800d0fb7aabc5ca96194a": ""
};

var isCustomWorkspace = function(workspaceId) {
	return !(workspaceId in KNOWN_WORKSPACES);
};

var checkIfScopesMatch = (scope, tableName) => {
    var scopeA = getScopePrefix(scope),
        scopeB = getScopePrefix(tableName);

    var match = false;

    if(scopeA.length > 0 && scopeB.length > 0)
        match = (scopeA == scopeB);

    if(!match && scope.toLowerCase() == "global" && tableName.startsWith("u_"))
        match = true;

    return match;
};

var getScopePrefix = (s) => {
    var scopePrefix = "";

    if(s == null || s == undefined)
        return scopePrefix;

    if(!s.startsWith("x_"))
        return scopePrefix;

    var parts = s.split("_");

    if(parts.length >= 2) {
        scopePrefix = parts[0] + "_" + parts[1];
    }

    return scopePrefix;
};

var process = (distinct) => {
    var promise = new Promise((resolve, reject) => {

        var fileName = path.join(__dirname, "./audits/workspaces.csv");       

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var general = new Data.DataTable("Legacy Workspaces");
            var modules = new Data.DataTable("Legacy Workspace Modules");
            var lists = new Data.DataTable("Legacy Workspace Lists");
            var distinctWorkspaces = {};
            var isDistinct = (distinct === true);
            var summary = {};
    
            general.columns = [
                'Workspace ID', 
                'Name', 
                'Created On', 
                'Created On - YYYY-MM', 
                'Navigation Type', 
                'Notifications Enabled', 
                'Search Enabled', 
                'User Preferences Enabled', 
                'Workspace Url', 
                'Brand Color',
                'Primary Color', 
                'Has Logo', 
                'Scope'
            ];

            modules.columns = [
                'Workspace ID', 
                'Workspace Name', 
                'Workspace Scope',
                'Module ID', 
                'Label',
                'Icon', 
            ];

            lists.columns = [
                'Workspace ID', 
                'Workspace Name', 
                'Workspace Scope', 
                'Table', 
                'Title', 
                'Category', 
                'Is Custom Table', 
                'Is Same Scope'
            ];
            
            auditData.forEach((row) => {
                if(row.data) {
                    for(var workspaceId in row.data) {
                        var workspace = row.data[workspaceId];
                        var isProduction = common.isProductionInstance(row.instance);

                        if(!isCustomWorkspace(workspaceId))
                            continue;

                        if(isDistinct && (distinctWorkspaces[workspaceId] != undefined || (isProduction && distinctWorkspaces[workspaceId] === false)))
                           continue;

                        distinctWorkspaces[workspaceId] = isProduction;

                        var ws = {
                            id: workspaceId,
                            name: workspace.name,
                            createdOn: workspace.createdOn,
                            createdOnMonthYear: moment(workspace.createdOn).format("YYYY-MM"),
                            navigationType: workspace.navigationType,
                            notifications: workspace.notifications,
                            search: workspace.search,
                            userPrefs: workspace.userPrefs,
                            url: workspace.url,
                            color: workspace.color,
                            primaryColor: workspace.primaryColor,
                            hasLogo:  (workspace.logo && workspace.logo.length > 0 ? true : false),
                            scope: workspace.scope
                        };

                        general.addRow(new Data.DataRow(row.instanceName, row.instance, ws));

                        if(workspace.modules && workspace.modules.length) {
                            workspace.modules.forEach((module) => {
                                modules.addRow(new Data.DataRow(row.instanceName, row.instance, {
                                    workspaceId: workspaceId,
                                    workspaceName: workspace.name,
                                    workspaceScope: workspace.scope,
                                    id: module.id,
                                    label: module.label,
                                    icon: module.icon
                                }));
                            }); 
                        }

                        if(workspace.lists && workspace.lists.length) {
                            workspace.lists.forEach((list) => {
                                var isCustomTable = false;
                                var isSameScope = false;

                                if(list.table != null && list.table != undefined) {
                                    if(list.table.startsWith("x_") || list.table.startsWith("u_"))
                                        isCustomTable = true;

                                    isSameScope = checkIfScopesMatch(workspace.scope, list.table);
                                }

                                lists.addRow(new Data.DataRow(row.instanceName, row.instance, {
                                    workspaceId: workspaceId,
                                    workspaceName: workspace.name,
                                    workspaceScope: workspace.scope,
                                    table: list.table,
                                    title: list.title,
                                    category: list.category,
                                    isCustomTable,
                                    isSameScope
                                }));
                            });
                        }

                        var account = common.getAccount(row.instance);

                        if(summary[account.accountNo] == undefined)
                            summary[account.accountNo] = { account: account, dataItem: { total: 0, production: 0 } };

                        summary[account.accountNo].dataItem.total++;
                        summary[account.accountNo].dataItem.production += (isProduction ? 1 : 0);
                    }
                }
            });

            var dataSet = new Data.DataSet();
            dataSet.addTable(general);
            dataSet.addTable(modules);
            dataSet.addTable(lists);

            dataSet.summary.columns = ["Total Legacy Workspaces", "Legacy Workspaces - Production"];
            
            for(var accountNo in summary) {
                dataSet.summary.addSummaryRow(summary[accountNo].account, summary[accountNo].dataItem);
            }

            resolve(dataSet);
        });
    });

    return promise;
};

exports.getWorkspaces = process;