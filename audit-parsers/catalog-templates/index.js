
const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require("moment");

var processTemplates = (wb, auditData) => {
    var ws = wb.addWorksheet("Templates");

    ws.setStandardColumns([
        { header: 'Template ID', width: 20 },
        { header: 'Template Name', width: 20 },
        { header: 'Count', width: 20, alignment: { horizontal: 'right' } }
    ]);

    auditData.forEach((row) => {
        if(row.data && row.data.templateCounts) {
            for(var id in row.data.templateCounts) {
                ws.addStandardRow(row.instanceName, row.instance, {
                    id: id,
                    name: row.data.templateCounts[id].name,
                    count: row.data.templateCounts[id].count,
                });
            }
        }
    });
};

var processSummary = (wb, auditData) => {
    var ws = wb.addWorksheet("Summary");

    ws.setStandardColumns([
        { header: 'Plugin Active', width: 20 },
        { header: 'Plugin Installed On', width: 20 },
        { header: 'Items - With Template', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Items - Without Template', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Record Producers - With Template', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Record Producers - Without Template', width: 20, alignment: { horizontal: 'right' } }
    ]);

    auditData.forEach((row) => {
        if(row.data) {

            var result = {
                installed: false,
                installedOn: "",
                itemsWithTemplate: 0,
                itemsWithoutTemplate: 0,
                rpWithTemplate: 0,
                rpWithoutTemplate: 0
            };

            if(row.data.plugin && row.data.plugin.active === true) {
                var installedOn = row.data.plugin.installed;                

                if(installedOn && installedOn.length) {
                    installedOn = moment(installedOn, 'YYYY-MM-DD HH:mm:ss').format("YYYY-MM");
                }

                result.installed = row.data.plugin.active;
                result.installedOn = installedOn;
            }

            if(row.data && row.data.itemCounts) {
                for(var month in row.data.itemCounts) {
                    var items = row.data.itemCounts[month].item;
                    var recordProducers = row.data.itemCounts[month].rp;

                    if(items != undefined) {
                        result.itemsWithTemplate += items.yes;
                        result.itemsWithoutTemplate += items.no;
                    }
    
                    if(recordProducers != undefined) {
                        result.rpWithTemplate += recordProducers.yes;
                        result.rpWithoutTemplate += recordProducers.no;
                    }
                }
            }
    
            ws.addStandardRow(row.instanceName, row.instance, result);
        }
    });
};

var processItemCounts = (wb, auditData) => {
    var ws = wb.addWorksheet("Item Counts By Year");

    ws.setColumns([
        { header: 'Instance Name', width: 22 },
        { header: 'Company', width: 42 },
        { header: 'Account Type', width: 17 },
        { header: 'Instance Purpose', width: 16 },
        { header: 'Year', width: 20 },
        { header: 'Items - With Template', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Items - Without Template', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Record Producers - With Template', width: 20, alignment: { horizontal: 'right' } },
        { header: 'Record Producers - Without Template', width: 20, alignment: { horizontal: 'right' } },
    ]);

    auditData.forEach((row) => {
        if(row.data && row.data.itemCounts) {

            var years = {};

            for(var month in row.data.itemCounts) {
                var items = row.data.itemCounts[month].item;
                var recordProducers = row.data.itemCounts[month].rp;
                var year = moment(month, 'MM/YYYY').format("YYYY");

                if(years[year] == undefined)
                    years[year] = { itemsWith: 0, itemsWithout: 0, rpWith: 0, rpWithout: 0 };

                if(items != undefined) {
                    years[year].itemsWith += items.yes;
                    years[year].itemsWithout += items.no;
                }

                if(recordProducers != undefined) {
                    years[year].rpWith += recordProducers.yes;
                    years[year].rpWithout += recordProducers.no;
                }
            }

            for(var year in years) {
                var result = {
                    instanceName: row.instanceName,
                    company: row.instance.account.accountName,
                    accountType: row.instance.account.accountType,
                    purpose: row.instance.purpose,
                    year: year,
                    itemsWith: years[year].itemsWith,
                    itemsWithout: years[year].itemsWithout,
                    rpWith: years[year].rpWith,
                    rpWithout: years[year].rpWithout
                };

                ws.addRow(result);
            }
        }
    });
};

var processTemplateOverrides = (wb, auditData) => {
    var ws = wb.addWorksheet("Template Overrides");

    ws.setColumns([
        { header: 'Instance Name', width: 22 },
        { header: 'Company', width: 42 },
        { header: 'Account Type', width: 17 },
        { header: 'Instance Purpose', width: 16 },
        { header: 'Property', width: 20 },
        { header: 'No. of templates', width: 20, alignment: { horizontal: 'right' } }
    ]);

    auditData.forEach((row) => {
        if(row.data && row.data.templateDetails) {

            for(var setting in row.data.templateDetails) {
                var result = {
                    instanceName: row.instanceName,
                    company: row.instance.account.accountName,
                    accountType: row.instance.account.accountType,
                    purpose: row.instance.purpose,
                    setting: setting,
                    count: row.data.templateDetails[setting]
                };

                ws.addRow(result);                
            }
        }
    });
};

(function(){

    var fileName = path.join(__dirname, "catalog-templates.csv");       

    FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

        var wb = new Audit.AuditWorkbook("catalog-templates-processed.xlsx");

        processSummary(wb, auditData);

        processTemplates(wb, auditData);

        processItemCounts(wb, auditData);

        processTemplateOverrides(wb, auditData);
        
        wb.commit().then(() => console.log("Finished!"));

    });

})();