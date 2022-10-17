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
        var fileName = "../developer-roles.xlsx";

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

            return values;
        };

        var worksheet = wb.addWorksheet("Developer Roles");
        worksheet.columns = generateColumns([
            { header: 'AES Role - Total', key: 'aesT' },
            { header: 'AES Role - 180', key: 'aes360' },
            { header: 'Delegated Dev - Total', key: 'ddT' },
            { header: 'Delegated Dev - 180', key: 'dd360' },
            { header: 'Source Control - Total', key: 'scT' },
            { header: 'Source Control - 180', key: 'sc360' },
            { header: 'Source Control + Delegated Dev', key: 'scdd' }
        ]);

        //
        // Now populate the worksheets
        //
        auditData.forEach((row) => {
            var record = {
                'aesT': 0,
                'aes360': 0,
                'ddT': 0,
                'dd360': 0,
                'scT': 0,
                'sc360': 0,
                'scdd': 0
            };

            if(row.data) {
                if(row.data.aesRole) {
                    record['aesT'] = row.data.aesRole.total;
                    record['aes360'] = row.data.aesRole['180'];
                }
                if(row.data.delegatedDeveloperRole) {
                    record['ddT'] = row.data.delegatedDeveloperRole.total;
                    record['dd360'] = row.data.delegatedDeveloperRole['180'];
                }
                if(row.data.sourceControlRole) {
                    record['scT'] = row.data.sourceControlRole.total;
                    record['sc360'] = row.data.sourceControlRole['180'];
                }
                if(row.data.delegatedDevWithSourceControl) {
                    record['scdd'] = row.data.delegatedDevWithSourceControl;
                }
            }
            worksheet.addRow(generateRowValues(row.instanceName, row, record));
        });


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