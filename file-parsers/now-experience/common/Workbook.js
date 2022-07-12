const ExcelJS = require('exceljs');


class Workbook {

    constructor(fileName) {
        this.fileName = fileName;
        this.writer = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: fileName });
        this.summaryWs = this.writer.addWorksheet("Summary");
    }

    addWorksheets(dataSet) {
        //
        // Create Worksheet for each table in the dataset
        //
        dataSet.tables.forEach((table) => {
            var ws = this.writer.addWorksheet(table.worksheetName);
            ws.columns = this.#writeColumns(table);            

            table.rows.forEach((row) => {
                ws.addRow(this.#writeRow(row)).commit();
            });

            ws.commit();
        });
    }

    addSummary(dataSets) {
        var accounts = {};
        var columns = [
            { header: 'Account No.', width: 12 },
            { header: 'Company', width: 42 },            
            { header: 'Account Type', width: 17 },
            { header: 'Primary Rep', width: 22 },
            { header: 'Solution Consultant', width: 23 },
            { header: 'App Engine Subscriber', width: 22 }
        ];        

        //
        // Get all the columns
        //
        dataSets.forEach((dataSet) => {
            dataSet.summary.columns.forEach((columnName) => {
                columns.push({ header: columnName, width: 20 });
            });
        });

        this.summaryWs.columns = columns;

        //
        // Build entire account collection
        //
        dataSets.forEach((dataSet) => {
            dataSet.summary.rows.forEach((row) => {
                var account = row.account;

                // Set up the account with the initial column values if it doesn't already exist
                if(accounts[account.accountNo] == undefined)
                    accounts[account.accountNo] = [account.accountNo, account.accountName, account.accountType, account.primarySalesRep, account.solutionConsultant, account.isAppEngineSubscriber];
            });
        });

        //
        // For each account, ensure we capture the dataItem or at least a default one
        //
        for(var accountNo in accounts) {

            dataSets.forEach((dataSet) => { 
                var dataItem = null;

                dataSet.summary.rows.forEach((row) => {
                    if(accountNo == row.account.accountNo) {
                        dataItem = row.dataItem;
                    }
                });

                if(dataItem == null)
                    dataItem = { total: 0, production: 0 };

                Object.keys(dataItem).forEach((key) => accounts[accountNo].push(dataItem[key]));
            });
        }       

        //
        // Now loop through all the accounts we just aggregated and write the rows
        //
        Object.keys(accounts).forEach((accountNo) => this.summaryWs.addRow(accounts[accountNo]).commit());
    }

    commit() {
        return this.writer.commit();
    }

    #writeColumns(table) {
        var columns = [
            { header: 'Instance Name', width: 22 },
            { header: 'Company', width: 42 },
            { header: 'Account No.', width: 12 },
            { header: 'Account Type', width: 17 },
            { header: 'Primary Rep', width: 22 },
            { header: 'Solution Consultant', width: 23 },
            { header: 'App Engine Subscriber', width: 22 },
            { header: 'Instance Version', width: 22 },
            { header: 'Instance Purpose', width: 16 },
        ];

        table.columns.forEach((columnName) => {
            columns.push({ header: columnName, width: 20 });
        });

        return columns;
    }

    #writeRow(row) {
        var values = [row.instanceName];

        if(row.account) {
            values = values.concat([row.account.accountName, row.account.accountNo, row.account.accountType, row.account.primarySalesRep, row.account.solutionConsultant, row.account.isAppEngineSubscriber])
        } else {
            values = values.concat(["","","","","",""]);
        }

        if(row.instance) {
            values = values.concat([row.instance.version, row.instance.purpose])
        } else {
            values = values.concat(["",""]);
        }
        
        for(var field in row.dataItem) {
            values.push(row.dataItem[field]);
        }

        return values;
    }
}

exports.Workbook = Workbook;