
const path = require('path');
const FileLoader = require('../common/FileLoader.js');
const ExcelJS = require('exceljs');

const OPERATIONS = [
    "add", 
    "subtract", 
    "multiply", 
    "divide", 
    "concat", 
    "datediff", 
    "dayofweek", 
    "length",
    // Quebec
    "substring", 
    "coalesce",
    "position",
    // Rome / undocumented
    "now",
    "jsonValue"
];

(function(){

    var fileName = path.join(__dirname, "results.csv");

    FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
        var wb = new ExcelJS.Workbook();
        var worksheet = wb.addWorksheet("Function fields");
        var resultsFileName = "function-field-usage.xlsx";

        var columns = [
            { header: 'Instance', width: 40 },
            { header: 'Customer', width: 40 },
            { header: 'AccountNo', width: 40 },
            { header: 'Is App Engine Subscriber', width: 40 },
            { header: 'Version', width: 40 },
            { header: 'Purpose', width: 40 },
            { header: 'Field Type', width: 15 },
            { header: 'Field Name', width: 20 },
            { header: 'Function Definition', width: 50 }
        ];

        OPERATIONS.forEach((operation) => {
            columns.push({ header: operation, width: 12 })
        });

        worksheet.columns = columns;
        
        auditData.forEach((row) => {
            
            if(row.data && row.data.length && Object.keys(row.data[0]).length) {
                for(var node in row.data[0]){
                    var thisNode = row.data[0][node],
                        functionDefinition = thisNode.function_definition;

                    var values = [row.instanceName];

                    if(row.instance) {
                        values.push(row.instance.customer, row.instance.accountNo, row.instance.isAppEngineSubscriber, row.instance.version, row.instance.purpose);
                    } else {
                        values.push("", "", "", "", "");
                    }

                    values.push(thisNode.internal_type, thisNode.name, functionDefinition);

                    if(functionDefinition.length) {
                        OPERATIONS.forEach((operation) => {
                            var hasFunction = (functionDefinition.toLowerCase().indexOf(operation) != -1);
                            values.push(hasFunction);
                        });
                    }

                    worksheet.addRow(values);
                }
            }
        });

        wb.xlsx.writeFile(resultsFileName).then(() => {
            console.log("Created file " + resultsFileName);
        });
    });

})();