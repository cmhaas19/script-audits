class DataSet {
    constructor() {      
        this.summary = new DataTable();
        this.tables = [];
    }
    addTable(table) { 
        this.tables.push(table);
    }
}

class DataTable {
    constructor(worksheetName) {
        this.worksheetName = worksheetName;
        this.columns = [];
        this.rows = [];
    }
    addRow(row) { 
        this.rows.push(row);
    }
    addSummaryRow(account, dataItem) {
        var row = new DataRow();
        row.account = account;
        row.dataItem = dataItem;
  
        this.rows.push(row);
    }
}

class DataRow {
    constructor(instanceName, instance, dataItem) {
        this.instanceName = instanceName;
        this.instance = instance;
        this.account = {};
        this.dataItem = dataItem;

        if(this.instance && this.instance.account)
            this.account = this.instance.account;
    }
}

exports.DataSet = DataSet;
exports.DataTable = DataTable;
exports.DataRow = DataRow;