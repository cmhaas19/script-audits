const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require('moment');
const fs = require('fs');

var loadFiles = async () => {
    var combined = {};
    var priorYearFileName = path.join(__dirname, "results-2022.csv"); 
    var currentYearFileName = path.join(__dirname, "results-2023.csv");

    var processFile = (auditData, prop) => {
        auditData.forEach((row) => {
            if(row.data && row.data.summary) {
                if(!combined[row.instanceName]) {
                    combined[row.instanceName] = {
                        instance: row.instance,
                        instanceName: row.instanceName,
                        summary: {
                            totalFilesModified: { priorYear: 0, currentYear: 0 },
                            ootbFilesModified: { priorYear: 0, currentYear: 0 },
                            customerFilesModified: { priorYear: 0, currentYear: 0 },
                            customerFilesModifiedExisting: { priorYear: 0, currentYear: 0 },
                            customerFilesModifiedNew: { priorYear: 0, currentYear: 0 },
                            linesOfCode: { priorYear: 0, currentYear: 0 },
                            unchanged: { priorYear: 0, currentYear: 0 },
                            maint: { priorYear: 0, currentYear: 0 }
                        },
                        tables: {}
                    };
                }
                var instance = combined[row.instanceName];
    
                instance.summary.totalFilesModified[prop] = (row.data.summary.o + row.data.summary.c);
                instance.summary.ootbFilesModified[prop] = row.data.summary.o;
                instance.summary.customerFilesModified[prop] = row.data.summary.c;
                instance.summary.customerFilesModifiedExisting[prop] = row.data.summary.c - row.data.summary.cc;
                instance.summary.customerFilesModifiedNew[prop] = row.data.summary.cc;
                instance.summary.linesOfCode[prop] = row.data.summary.l;
                instance.summary.unchanged[prop] = row.data.summary.unc;
                instance.summary.maint[prop] = row.data.summary.m;
    
                Object.keys(row.data.tables).forEach((tableName) => {
                    var table = row.data.tables[tableName];
    
                    if(!combined[row.instanceName].tables[tableName]) {
                        combined[row.instanceName].tables[tableName] = {
                            totalFilesModified: { priorYear: 0, currentYear: 0 },
                            ootbFilesModified: { priorYear: 0, currentYear: 0 },
                            customerFilesModified: { priorYear: 0, currentYear: 0 },
                            linesOfCode: { priorYear: 0, currentYear: 0 },
                            unchanged: { priorYear: 0, currentYear: 0 },
                            maint: { priorYear: 0, currentYear: 0 }
                        };
                    }
                    var combinedTable = combined[row.instanceName].tables[tableName];
    
                    combinedTable.totalFilesModified[prop] = (table.o + table.c);
                    combinedTable.ootbFilesModified[prop] = table.o;
                    combinedTable.customerFilesModified[prop] = table.c;
                    combinedTable.linesOfCode[prop] = table.l;
                    combinedTable.unchanged[prop] = table.unc;
                    combinedTable.maint[prop] = table.m;
                });
            }
        });
    };

    var auditData = await FileLoader.loadFileWithInstancesAndAccounts(priorYearFileName);
    processFile(auditData, "priorYear");

    auditData = await FileLoader.loadFileWithInstancesAndAccounts(currentYearFileName);
    processFile(auditData, "currentYear");

    return combined;
};

var writeSpreadsheet = async (combined) => {

    var calculateDelta = (priorYear, currentYear) => {
        var difference = currentYear - priorYear;
        var percent = 0;

        if(priorYear != 0) {
            percent = difference / priorYear;
        } else {
            percent = 1;
        }
        return {
            difference,
            percent
        };
    };

    var wb = new Audit.AuditWorkbook("code-usage-comparison-2022-2023.xlsx");
    var ws = wb.addWorksheet("Instance Rollup");
    var wsTable = wb.addWorksheet("Instance & Table Rollup");

    ws.setStandardColumns([
        { header: 'Total Files Modified - 2022', width: 25 },
        { header: 'Total Files Modified - 2023', width: 25 },
        { header: 'Total Files Modified - Delta', width: 25 },
        { header: 'Total Files Modified - Delta %', width: 25 },
        { header: 'OOTB Files Modified - 2022', width: 25 },
        { header: 'OOTB Files Modified - 2023', width: 25 },
        { header: 'OOTB Files Modified - Delta', width: 25 },
        { header: 'OOTB Files Modified - Delta %', width: 25 },
        { header: 'Total Customer Files Modified - 2022', width: 25 },
        { header: 'Total Customer Files Modified - 2023', width: 25 },
        { header: 'Total Customer Files Modified - Delta', width: 25 },
        { header: 'Total Customer Files Modified - Delta %', width: 25 },
        { header: 'Total Lines of Code Changed - 2022', width: 25 },
        { header: 'Total Lines of Code Changed - 2023', width: 25 },
        { header: 'Total Lines of Code Changed - Delta', width: 25 },
        { header: 'Total Lines of Code Changed - Delta %', width: 25 },
        { header: 'Excluded: Modified Files with unchanged script fields - 2022', width: 25 },
        { header: 'Excluded: Modified Files with unchanged script fields - 2023', width: 25 },
        { header: 'Excluded: Modified Files with unchanged script fields - Delta', width: 25 },
        { header: 'Excluded: Modified Files with unchanged script fields - Delta %', width: 25 },
        { header: 'Excluded: Modified Files by ServiceNow - 2022', width: 25 },
        { header: 'Excluded: Modified Files by ServiceNow - 2023', width: 25 },
        { header: 'Excluded: Modified Files by ServiceNow - Delta', width: 25 },
        { header: 'Excluded: Modified Files by ServiceNow - Delta %', width: 25 }
    ]);

    wsTable.setStandardColumns([
        { header: 'Table Name', width: 25 },
        { header: 'Total Files Modified - 2022', width: 25 },
        { header: 'Total Files Modified - 2023', width: 25 },
        { header: 'Total Files Modified - Delta', width: 25 },
        { header: 'Total Files Modified - Delta %', width: 25 },
        { header: 'OOTB Files Modified - 2022', width: 25 },
        { header: 'OOTB Files Modified - 2023', width: 25 },
        { header: 'OOTB Files Modified - Delta', width: 25 },
        { header: 'OOTB Files Modified - Delta %', width: 25 },
        { header: 'Total Customer Files Modified - 2022', width: 25 },
        { header: 'Total Customer Files Modified - 2023', width: 25 },
        { header: 'Total Customer Files Modified - Delta', width: 25 },
        { header: 'Total Customer Files Modified - Delta %', width: 25 },
        { header: 'Total Lines of Code Changed - 2022', width: 25 },
        { header: 'Total Lines of Code Changed - 2023', width: 25 },
        { header: 'Total Lines of Code Changed - Delta', width: 25 },
        { header: 'Total Lines of Code Changed - Delta %', width: 25 },
        { header: 'Excluded: Modified Files with unchanged script fields - 2022', width: 25 },
        { header: 'Excluded: Modified Files with unchanged script fields - 2023', width: 25 },
        { header: 'Excluded: Modified Files with unchanged script fields - Delta', width: 25 },
        { header: 'Excluded: Modified Files with unchanged script fields - Delta %', width: 25 },
        { header: 'Excluded: Modified Files by ServiceNow - 2022', width: 25 },
        { header: 'Excluded: Modified Files by ServiceNow - 2023', width: 25 },
        { header: 'Excluded: Modified Files by ServiceNow - Delta', width: 25 },
        { header: 'Excluded: Modified Files by ServiceNow - Delta %', width: 25 }
    ]);

    var totals = {
        totalFilesModified: { priorYear: 0, currentYear: 0 },
        ootbFilesModified: { priorYear: 0, currentYear: 0 },
        customerFilesModified: { priorYear: 0, currentYear: 0 },
        customerFilesModifiedExisting: { priorYear: 0, currentYear: 0 },
        customerFilesModifiedNew: { priorYear: 0, currentYear: 0 },
        linesOfCode: { priorYear: 0, currentYear: 0 },
        unchanged: { priorYear: 0, currentYear: 0 },
        maint: { priorYear: 0, currentYear: 0 }
    };

    var tableTotals = {};

    Object.keys(combined).forEach((instanceName) => {
        var current = combined[instanceName];
        var summary = current.summary;

        if(current.instance.purpose != "Production")
            return;

        totals.totalFilesModified.priorYear += summary.totalFilesModified.priorYear;
        totals.totalFilesModified.currentYear += summary.totalFilesModified.currentYear;
        totals.ootbFilesModified.priorYear += summary.ootbFilesModified.priorYear;
        totals.ootbFilesModified.currentYear += summary.ootbFilesModified.currentYear;
        totals.customerFilesModified.priorYear += summary.customerFilesModified.priorYear;
        totals.customerFilesModified.currentYear += summary.customerFilesModified.currentYear;
        totals.customerFilesModifiedExisting.priorYear += summary.customerFilesModifiedExisting.priorYear;
        totals.customerFilesModifiedExisting.currentYear += summary.customerFilesModifiedExisting.currentYear;
        totals.customerFilesModifiedNew.priorYear += summary.customerFilesModifiedNew.priorYear;
        totals.customerFilesModifiedNew.currentYear += summary.customerFilesModifiedNew.currentYear;
        totals.linesOfCode.priorYear += summary.linesOfCode.priorYear;
        totals.linesOfCode.currentYear += summary.linesOfCode.currentYear;
        totals.unchanged.priorYear += summary.unchanged.priorYear;
        totals.unchanged.currentYear += summary.unchanged.currentYear;
        totals.maint.priorYear += summary.maint.priorYear;
        totals.maint.currentYear += summary.maint.currentYear;

        ws.addStandardRow(instanceName, current.instance, {
            a: summary.totalFilesModified.priorYear,
            b: summary.totalFilesModified.currentYear,
            c: calculateDelta(summary.totalFilesModified.priorYear, summary.totalFilesModified.currentYear).difference,
            d: calculateDelta(summary.totalFilesModified.priorYear, summary.totalFilesModified.currentYear).percent,
            e: summary.ootbFilesModified.priorYear,
            f: summary.ootbFilesModified.currentYear,
            g: calculateDelta(summary.ootbFilesModified.priorYear, summary.ootbFilesModified.currentYear).difference,
            h: calculateDelta(summary.ootbFilesModified.priorYear, summary.ootbFilesModified.currentYear).percent,
            i: summary.customerFilesModified.priorYear,
            j: summary.customerFilesModified.currentYear,
            k: calculateDelta(summary.customerFilesModified.priorYear, summary.customerFilesModified.currentYear).difference,
            l: calculateDelta(summary.customerFilesModified.priorYear, summary.customerFilesModified.currentYear).percent,
            m: summary.linesOfCode.priorYear,
            n: summary.linesOfCode.currentYear,
            o: calculateDelta(summary.linesOfCode.priorYear, summary.linesOfCode.currentYear).difference,
            p: calculateDelta(summary.linesOfCode.priorYear, summary.linesOfCode.currentYear).percent,
            q: summary.unchanged.priorYear,
            r: summary.unchanged.currentYear,
            s: calculateDelta(summary.unchanged.priorYear, summary.unchanged.currentYear).difference,
            t: calculateDelta(summary.unchanged.priorYear, summary.unchanged.currentYear).percent,
            u: summary.maint.priorYear,
            v: summary.maint.currentYear,
            x: calculateDelta(summary.maint.priorYear, summary.maint.currentYear).difference,
            y: calculateDelta(summary.maint.priorYear, summary.maint.currentYear).percent
        });

        Object.keys(current.tables).forEach((tableName) => {
            var table = current.tables[tableName];

            if(tableTotals[tableName] == undefined) {
                tableTotals[tableName] = {
                    totalFilesModified: { priorYear: 0, currentYear: 0 },
                    ootbFilesModified: { priorYear: 0, currentYear: 0 },
                    customerFilesModified: { priorYear: 0, currentYear: 0 },
                    linesOfCode: { priorYear: 0, currentYear: 0 },
                    unchanged: { priorYear: 0, currentYear: 0 },
                    maint: { priorYear: 0, currentYear: 0 }
                }
            };

            tableTotals[tableName].totalFilesModified.priorYear += table.totalFilesModified.priorYear;
            tableTotals[tableName].totalFilesModified.currentYear += table.totalFilesModified.currentYear;
            tableTotals[tableName].ootbFilesModified.priorYear += table.ootbFilesModified.priorYear;
            tableTotals[tableName].ootbFilesModified.currentYear += table.ootbFilesModified.currentYear;
            tableTotals[tableName].customerFilesModified.priorYear += table.customerFilesModified.priorYear;
            tableTotals[tableName].customerFilesModified.currentYear += table.customerFilesModified.currentYear;
            tableTotals[tableName].linesOfCode.priorYear += table.linesOfCode.priorYear;
            tableTotals[tableName].linesOfCode.currentYear += table.linesOfCode.currentYear;
            tableTotals[tableName].unchanged.priorYear += table.unchanged.priorYear;
            tableTotals[tableName].unchanged.currentYear += table.unchanged.currentYear;
            tableTotals[tableName].maint.priorYear += table.maint.priorYear;
            tableTotals[tableName].maint.currentYear += table.maint.currentYear;

            wsTable.addStandardRow(instanceName, current.instance, {
                aa: tableName,
                a: table.totalFilesModified.priorYear,
                b: table.totalFilesModified.currentYear,
                c: calculateDelta(table.totalFilesModified.priorYear, table.totalFilesModified.currentYear).difference,
                d: calculateDelta(table.totalFilesModified.priorYear, table.totalFilesModified.currentYear).percent,
                e: table.ootbFilesModified.priorYear,
                f: table.ootbFilesModified.currentYear,
                g: calculateDelta(table.ootbFilesModified.priorYear, table.ootbFilesModified.currentYear).difference,
                h: calculateDelta(table.ootbFilesModified.priorYear, table.ootbFilesModified.currentYear).percent,
                i: table.customerFilesModified.priorYear,
                j: table.customerFilesModified.currentYear,
                k: calculateDelta(table.customerFilesModified.priorYear, table.customerFilesModified.currentYear).difference,
                l: calculateDelta(table.customerFilesModified.priorYear, table.customerFilesModified.currentYear).percent,
                m: table.linesOfCode.priorYear,
                n: table.linesOfCode.currentYear,
                o: calculateDelta(table.linesOfCode.priorYear, table.linesOfCode.currentYear).difference,
                p: calculateDelta(table.linesOfCode.priorYear, table.linesOfCode.currentYear).percent,
                q: table.unchanged.priorYear,
                r: table.unchanged.currentYear,
                s: calculateDelta(table.unchanged.priorYear, table.unchanged.currentYear).difference,
                t: calculateDelta(table.unchanged.priorYear, table.unchanged.currentYear).percent,
                u: table.maint.priorYear,
                v: table.maint.currentYear,
                x: calculateDelta(table.maint.priorYear, table.maint.currentYear).difference,
                y: calculateDelta(table.maint.priorYear, table.maint.currentYear).percent
            });
        });
    });

    var totalWs = wb.addWorksheet("Totals");
    totalWs.setColumns([
        { header: '', width: 25 },
        { header: '2022', width: 25 },
        { header: '2023', width: 25 },
        { header: 'Change', width: 25 },
        { header: '% Change', width: 25 }
    ]);
    totalWs.addRow({ 
        a: "Total Files Modified",
        b: totals.totalFilesModified.priorYear, 
        c: totals.totalFilesModified.currentYear,
        d: calculateDelta(totals.totalFilesModified.priorYear, totals.totalFilesModified.currentYear).difference,
        e: calculateDelta(totals.totalFilesModified.priorYear, totals.totalFilesModified.currentYear).percent
    });
    totalWs.addRow({ 
        a: "OOTB Files Modified",
        b: totals.ootbFilesModified.priorYear, 
        c: totals.ootbFilesModified.currentYear,
        d: calculateDelta(totals.ootbFilesModified.priorYear, totals.ootbFilesModified.currentYear).difference,
        e: calculateDelta(totals.ootbFilesModified.priorYear, totals.ootbFilesModified.currentYear).percent
    });
    totalWs.addRow({ 
        a: "Total Customer Files Modified",
        b: totals.customerFilesModified.priorYear, 
        c: totals.customerFilesModified.currentYear,
        d: calculateDelta(totals.customerFilesModified.priorYear, totals.customerFilesModified.currentYear).difference,
        e: calculateDelta(totals.customerFilesModified.priorYear, totals.customerFilesModified.currentYear).percent
    });
    totalWs.addRow({ 
        a: "    Customer Files Modified – Existing",
        b: totals.customerFilesModifiedExisting.priorYear, 
        c: totals.customerFilesModifiedExisting.currentYear,
        d: calculateDelta(totals.customerFilesModifiedExisting.priorYear, totals.customerFilesModifiedExisting.currentYear).difference,
        e: calculateDelta(totals.customerFilesModifiedExisting.priorYear, totals.customerFilesModifiedExisting.currentYear).percent
    });
    totalWs.addRow({ 
        a: "    Customer Files Modified – New",
        b: totals.customerFilesModifiedNew.priorYear, 
        c: totals.customerFilesModifiedNew.currentYear,
        d: calculateDelta(totals.customerFilesModifiedNew.priorYear, totals.customerFilesModifiedNew.currentYear).difference,
        e: calculateDelta(totals.customerFilesModifiedNew.priorYear, totals.customerFilesModifiedNew.currentYear).percent
    });
    totalWs.addRow({ 
        a: "Total Lines of Code Changed",
        b: totals.linesOfCode.priorYear, 
        c: totals.linesOfCode.currentYear,
        d: calculateDelta(totals.linesOfCode.priorYear, totals.linesOfCode.currentYear).difference,
        e: calculateDelta(totals.linesOfCode.priorYear, totals.linesOfCode.currentYear).percent
    });
    totalWs.addRow({ 
        a: "Excluded: Modified Files with unchanged script fields",
        b: totals.unchanged.priorYear, 
        c: totals.unchanged.currentYear,
        d: calculateDelta(totals.unchanged.priorYear, totals.unchanged.currentYear).difference,
        e: calculateDelta(totals.unchanged.priorYear, totals.unchanged.currentYear).percent
    });
    totalWs.addRow({ 
        a: "Excluded: Modified Files by ServiceNow",
        b: totals.maint.priorYear, 
        c: totals.maint.currentYear,
        d: calculateDelta(totals.maint.priorYear, totals.maint.currentYear).difference,
        e: calculateDelta(totals.maint.priorYear, totals.maint.currentYear).percent
    });

    await wb.commit();
};

(function(){

    (async () => {
        const combined = await loadFiles();
        console.log(`Combined ${Object.keys(combined).length} instances.`);
        
        await writeSpreadsheet(combined);
        console.log("Finished!");
    })();

})();