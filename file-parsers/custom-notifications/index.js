const ExcelJS = require('exceljs');
const fastCsv = require("fast-csv");
const fs = require('fs')
const moment = require('moment');
const EMPTY_PAYLOAD = "Empty Payload";
const AUDIT_STATE_COMPLETED = "Completed";

var FILE_DIRECTORY = "Customer";

var loadInstanceData = () => {
	var promise = new Promise((resolve, reject) => {

		var instances = {};

        fastCsv.parseFile("../../instance-data/" + FILE_DIRECTORY + "/instances.csv")
            .on("data", data => {
                var instanceName = data[0],
                    accountNo = data[2];

                instances[instanceName] = {
                    customer: data[1],
                    accountNo: accountNo,
                    version: data[3],
                    purpose: data[4],
                    category: data[5],
                    subCategory: data[6]
                };
            })
            .on("end", () => {
                console.log("Loaded " + Object.keys(instances).length + " instances.");
                resolve(instances);
            });
	});

	return promise;
};

var parseCsvFile = () => {

    var auditData = [];

	var parsePayload = function(payload) {
		if(payload && payload.length && payload != EMPTY_PAYLOAD) {
			if(payload.startsWith("*** Script: ")) {
				var jsonString = payload.substring(11);
				try { return JSON.parse(jsonString); } catch(e) {  }
			}
		}
	};

    var fileName = "../results.csv";

	var promise = new Promise((resolve, reject) => {
		fastCsv.parseFile(fileName).on("data", data => {
			var row = {
				instanceName: data[2],
				auditState: data[0],
				errorDescription: data[1],
				success: (data[0] == AUDIT_STATE_COMPLETED),
				data: parsePayload(data[3])
			};

            auditData.push(row);

		})
		.on("end", rowCount => resolve(auditData) );
	});

	return promise;
};

var loadFile = (instances) => {
    var promise = new Promise((resolve, reject) => {        
        parseCsvFile().then((auditData) => {
            //
            // Add the instance data
            //
            auditData.forEach((row) => {
                var instanceName = row.instanceName,
                    accountInfo = instances[instanceName];

                if(accountInfo != undefined)
                    row.accountInfo = accountInfo;
                
            });

            resolve(auditData);
        });
	});

	return promise;
};


var writeWorkbook = (auditData) => {
    var promise = new Promise((resolve, reject) => {
        var wb = new ExcelJS.Workbook();
        var fileName = "../custom-app-notifications.xlsx";

        var generateColumns = (values) => {
            var columns = [
                { header: 'Instance Name', key: 'instanceName', width: 22 },
                { header: 'Company', key: 'company', width: 42 },
                { header: 'Account No.', key: 'accountNo', width: 13 },
                { header: 'Instance Version', key: 'instanceVersion', width: 63 },
                { header: 'Instance Purpose', key: 'instancePurpose', width: 16 },
            ];

            return columns.concat(values);
        };

        var generateRowValues = (instanceName, instance, values) => {
            if(instance.accountInfo){
                values['instanceName'] = instanceName;
                values['company'] = instance.accountInfo.customer;
                values['accountNo'] = instance.accountInfo.accountNo;
                values['instanceVersion'] = instance.accountInfo.version;
                values['instancePurpose'] = instance.accountInfo.purpose;
            }
            else {
                values['instanceName'] = instanceName;
            }

            //console.log(values);

            return values;
        };

        //
        // One pass to understand the necessary worksheets and columns
        //
        var tables = {};

        auditData.forEach((row) => {
            if(row.data && row.data.tableData) {
                for(var table in row.data.tableData) {
                    if(tables[table] == undefined)
                        tables[table] = {};

                    row.data.tableData[table].forEach((record) => {
                        for(var field in record) {
                            if(tables[table][field] == undefined)
                                tables[table][field] = true;
                        }
                    });
                }
            }
        });

        //
        // Now build the worksheets
        //
        for(var table in tables) {
            var worksheet = wb.addWorksheet(table);
            var columns = [];

            for(var field in tables[table]){
                columns.push({ header: field, key: field });
            }

            worksheet.columns = generateColumns(columns);
        }

        //
        // Now populate the worksheets
        //
        auditData.forEach((row) => {
            if(row.data && row.data.tableData) {
                for(var table in row.data.tableData) {
                    var worksheet  = wb.getWorksheet(table);

                    row.data.tableData[table].forEach((record) => {
                        worksheet.addRow(generateRowValues(row.instanceName, row, record));
                    });
                }
            }
        });

        //
        // Errors
        //
        /*
        (function(){

            const workSheet = wb.addWorksheet('Errors');

            workSheet.columns = generateColumns([
                { header: 'Audit', width: 8 },
                { header: 'Audit State', width: 12 },
                { header: 'Error Description', width: 42 }
            ]);
            workSheet.autoFilter = { from: 'A1', to: 'J1' };

            for(var instanceName in auditData){
                var instance = auditData[instanceName];

                for(var auditName in instance) {
                    var audit = instance[auditName];

                    if(Array.isArray(audit)){
                        audit.forEach((row) => {

                            if(!row.success && instanceName != "Instance Name" && instanceName != "u_instance_name") {
                                workSheet.addRow(generateRowValues(instanceName, instance,[auditName, row.auditState, row.errorDescription]));
                            }

                            if(auditName == "settings"){
                                if(!row.success){
                                    switch(row.auditState){
                                        case "Failed":
                                            overviewData.instances.errors++;
                                            break;
                                        case "Excluded":
                                            overviewData.instances.excluded++;
                                            break;
                                    }
                                } else {
                                    overviewData.instances.successful++;
                                }
                            }
                        });
                    }
                }
            }

            console.log("Parsed errors");

        })();
        */


        //
        // And finally, actually write out the spreadsheet
        //
        wb.xlsx.writeFile(fileName).then(() => {
            console.log("Created file " + fileName);
            resolve();
        });
	});

	return promise;
};

(function(){
    var args = process.argv;

    if(args && args.length >= 3)
        FILE_DIRECTORY = args[2];

    loadInstanceData()
        .then((instances) => loadFile(instances))
        .then((auditData) => writeWorkbook(auditData));

})();