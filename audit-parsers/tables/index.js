const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require("moment");

(function(){

    var fileName = path.join(__dirname, "custom-tables-audit.csv");       

    FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

        var wb = new Audit.AuditWorkbook("custom-table-audit.xlsx");

        var ws = wb.addWorksheet("Summary");

        ws.setStandardColumns([
            { header: 'Table Name', width: 20 },
            { header: 'Created On', width: 20 },
            { header: 'Created On YYYY-MM', width: 20 },
            { header: 'Parent Table', width: 20 },
            { header: 'Root Table', width: 20 },
            { header: 'Full Path', width: 20 },
            { header: 'Is Global', width: 20 },
            { header: 'Is Scoped', width: 20 }
        ]);

        auditData.forEach((row) => {
            if(row.data && row.data.customTables) {
                var customTables = row.data.customTables;
    
                for(var tableName in customTables) {
                    var table = customTables[tableName];              

                    var record = {
                        tableName: tableName,
                        createdOn: "",
                        createdOnYearMonth: "",
                        parentTable: "",
                        rootTable: "",
                        fullPath: "",
                        isGlobal: tableName.startsWith("u_"),
                        isScoped: tableName.startsWith("x_")
                    };
    
                    if(table.createdOn && table.createdOn.length) {
                        record.createdOn = table.createdOn;
                        record.createdOnYearMonth = moment(table.createdOn).format("YYYY-MM");
                    } 
    
                    if(table.path && table.path.length) {
                        record.parentTable = table.path[0];
                        record.rootTable = table.path[table.path.length - 1];
                        record.fullPath = table.path.join(" > ");
                    } 
    
                    ws.addStandardRow(row.instanceName, row.instance, record);
                }
            }
        });

        wb.commit().then(() => console.log("Finished!"));

    });

})();