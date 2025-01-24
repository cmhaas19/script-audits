const ExcelJS = require('exceljs');

class AuditWorksheet {
    constructor(worksheetName, workbook) {
        this.worksheetName = worksheetName;
        this.workbook = workbook;
        this.worksheet = workbook.addWorksheet(worksheetName);
    }
    
    setAccountColumns(extraColumns) {
        var defaultColumns = [
            { header: 'Company', width: 42 },
            { header: 'Account No.', width: 12 },
            { header: 'ACV', width: 12 },
            { header: 'Account Type', width: 17 },
            { header: 'Primary Rep', width: 22 },
            { header: 'Solution Consultant', width: 23 },
            { header: 'App Engine Subscriber', width: 22 }
        ];

        this.setColumns(defaultColumns.concat(extraColumns));
    }

    setStandardColumns(extraColumns) {
        var defaultColumns = [
            { header: 'Instance Name', width: 22 },
            { header: 'Company', width: 42 },
            { header: 'Account No.', width: 12 },
            { header: 'ACV', width: 12 },
            { header: 'Account Type', width: 17 },
            { header: 'Primary Rep', width: 22 },
            { header: 'Solution Consultant', width: 23 },
            { header: 'App Engine Subscriber', width: 22 },
            { header: 'Instance Version', width: 63 },
            { header: 'Instance Purpose', width: 16 },
        ];

        this.setColumns(defaultColumns.concat(extraColumns));
    }

    setColumns(columns) {
        this.worksheet.columns = columns;

        var columnLetters = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ"];

        this.worksheet.autoFilter = { 
            from: 'A1', 
            to: columnLetters[columns.length - 1] + "1"
        };
    }

    addAccountRow(account, row) {
        var rowValues = [];

        if(account) {
            rowValues = [
                account.accountName, 
                account.accountNo,
                account.totalACV,  
                account.accountType, 
                account.primarySalesRep, 
                account.solutionConsultant, 
                account.isAppEngineSubscriber
            ];
        }                
        else {
            rowValues = [
                "",
                "",
                "",
                "",
                "",
                "",
                ""
            ];
        }
        
        for(var prop in row) {
            rowValues.push(row[prop]);
        }

        this.worksheet.addRow(rowValues).commit();
    }

    addStandardRow(instanceName, instance, row) {
        var rowValues = [];
        var instanceInfo = instance;

        if(instance && instance.instanceInfo)
            instanceInfo = instance.instanceInfo;

        if(instanceInfo && instanceInfo.account) {
            rowValues = [
                instanceName, 
                instanceInfo.account.accountName, 
                instanceInfo.account.accountNo, 
                instanceInfo.account.totalACV,
                instanceInfo.account.accountType, 
                instanceInfo.account.primarySalesRep, 
                instanceInfo.account.solutionConsultant, 
                instanceInfo.account.isAppEngineSubscriber, 
                instanceInfo.version, 
                instanceInfo.purpose
            ];
        }                
        else {
            rowValues = [
                instanceName,
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                ""
            ];
        }
        
        for(var prop in row) {
            rowValues.push(row[prop]);
        }

        this.worksheet.addRow(rowValues).commit();
    }

    addRow(row) {
        var values = [];

        if(row) {
            for(var prop in row) {
                values.push(row[prop]);
            }
        }

        this.worksheet.addRow(values).commit();
    }

    addTextRow(values) {
        this.worksheet.addRow(values).commit();
    }
}

class AuditWorkbook {

    constructor(fileName) {
        this.fileName = fileName;
        this.writer = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: fileName });
    }

    addWorksheet(worksheetName) {
        var worksheet = new AuditWorksheet(worksheetName, this.writer);
        return worksheet;
    }

    commit() {
        return this.writer.commit();
    }
}

exports.AuditWorkbook = AuditWorkbook;