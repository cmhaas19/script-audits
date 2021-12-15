
const path = require('path');
const sharedData = require('../shared/shared');
const ExcelJS = require('exceljs');
const moment = require("moment");


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

const KNOWN_LANDING_PAGES = {
	"4cc7a8297710330022f7f4d2681061b3": "Default Landing Page",
	"8a58283f532c330083f3ddeeff7b12c3": "Incident Overview",
	"babaa55c73f033000afabd49faf6a7bf": "CSM Landing Page",
	"55411fdd23240010f4b4c50947bf658d": "CSM Landing Page",
	"2a464ef9232400100e4bc50947bf65ee": "CSM Landing Page",
	"d287f749232000100e4bc50947bf6596": "Incident Overview", //?
	"f4ee6ecd236000100e4bc50947bf655d": "Default Landing Page", //?
	"e94b6df15320330083f3ddeeff7b12f8": "Incident Overview - Premium",
	"b136b29123240010f4b4c50947bf6514": "Incident Overview - Premium",
	"c427619053b8330094fbddeeff7b1220": "HR Landing Page",
	"b8e6ad5c5378330094fbddeeff7b1256": "HR Landing Page (CD)"
};

function isCustomLandingPage(landingPageId) {
	return !(landingPageId in KNOWN_LANDING_PAGES);
}

function isCustomWorkspace(workspaceId) {
	return !(workspaceId in KNOWN_WORKSPACES);
}

var generateColumns = (values) => {
    var columns = [
        { header: 'Instance Name', width: 22 },
        { header: 'Company', width: 16 },
        { header: 'Account No.', width: 13 },
        { header: 'Instance Version', width: 22 },
        { header: 'Instance Purpose', width: 16 },
    ];

    return columns.concat(values);
};

var generateRowValues = (instanceName, instance, values) => {
    var rowValues = [];

    if(instance)
        rowValues = [instanceName, instance.customer, instance.accountNo, instance.version, instance.purpose];
    else
        rowValues = [instanceName,"","","",""];

    return rowValues.concat(values);
};

var process = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "workspace-results.xlsx"
        });

        var fileName = path.join(__dirname, "workspaces.csv");       

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var generalWs = wb.addWorksheet("General");
            var moduleWs = wb.addWorksheet("Modules");
            var listWs = wb.addWorksheet("Lists");
    
            generalWs.columns = generateColumns([
                { header: 'Workspace ID', width: 20 },
                { header: 'Name', width: 20 },
                { header: 'Description', width: 20 },
                { header: 'Created On', width: 20 },
                { header: 'Navigation Type', width: 30 },
                { header: 'Notifications Enabled', width: 20 },
                { header: 'Search Enabled', width: 15 },
                { header: 'User Preferences Enabled', width: 15 },
                { header: 'Workspace Url', width: 15 },
                { header: 'Brand Color', width: 15 },
                { header: 'Primary Color', width: 15 },
                { header: 'Is Custom', width: 15 }
            ]);

            moduleWs.columns = generateColumns([
                { header: 'Workspace ID', width: 20 },
                { header: 'Workspace Name', width: 20 },
                { header: 'Module Sys ID', width: 20 },
                { header: 'Module ID', width: 20 },
                { header: 'Label', width: 20 },
                { header: 'Order', width: 20 },
                { header: 'Icon', width: 20 },
                { header: 'Type', width: 30 }
            ]);

            listWs.columns = generateColumns([
                { header: 'Workspace ID', width: 20 },
                { header: 'Workspace Name', width: 20 },
                { header: 'List ID', width: 20 },
                { header: 'Table', width: 20 },
                { header: 'Title', width: 20 },
                { header: 'Category', width: 20 },
                { header: 'Active', width: 30 }
            ]);
            
            auditData.forEach((row) => {

                if(row.instance && row.instance.purpose == "Production" && row.data) {

                    for(var workspaceId in row.data) {
                        var workspace = row.data[workspaceId];

                        if(!isCustomWorkspace(workspace.id))
                            continue;

                        generalWs.addRow(
                            generateRowValues(row.instanceName, row.instance, [
                                workspace.id,
                                workspace.name,
                                workspace.description,
                                workspace.createdOn,
                                workspace.navigationType,
                                workspace.notificationsEnabled,
                                workspace.searchEnabled,
                                workspace.userPreferencesEnabled,
                                workspace.workspaceUrl,
                                workspace.brandColor,
                                workspace.primaryColor,
                                isCustomWorkspace(workspaceId)])).commit();

                        if(workspace.modules) {
                            for(var moduleId in workspace.modules) {
                                var module = workspace.modules[moduleId];

                                moduleWs.addRow(
                                    generateRowValues(row.instanceName, row.instance, [
                                        workspace.id,
                                        workspace.name,
                                        moduleId,
                                        module.id,
                                        module.label,
                                        module.order,
                                        module.icon,
                                        module.type,])).commit();
                            }
                        }

                        if(workspace.lists) {
                            for(var listsId in workspace.lists) {
                                var list = workspace.lists[listsId];

                                listWs.addRow(
                                    generateRowValues(row.instanceName, row.instance, [
                                        workspace.id,
                                        workspace.name,
                                        listsId,
                                        list.table,
                                        list.title,
                                        list.category,
                                        list.active])).commit();
                            }
                        }
                    }
                }
            });

            generalWs.commit();
            moduleWs.commit();
            listWs.commit();
            
            wb.commit().then(() => {
                resolve();
            });
        });
    });

    return promise;
};


(function(){

    process()
        .then(() => { console.log("Done") });

})();