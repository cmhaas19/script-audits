const path = require('path');
const fastCsv = require("fast-csv");
const EMPTY_PAYLOAD = "Empty Payload";
const AUDIT_STATE_COMPLETED = "Completed";

var loadInstanceData = (instanceType) => {
	var promise = new Promise((resolve, reject) => {

		var instances = {};
        var filePrefix = "customer";

        if(instanceType)
            filePrefix = instanceType;

        var fileName = path.join(__dirname, filePrefix + '-instances.csv');

        fastCsv.parseFile(fileName)
            .on("data", data => {
                var instanceName = data[0],
                    accountNo = data[2];

                instances[instanceName] = {
                    customer: data[1],
                    accountNo: accountNo,
                    isAppEngineSubscriber: false,
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

var loadAccountData = () => {
	var promise = new Promise((resolve, reject) => {
		var accounts = {};
        var fileName = path.join(__dirname, "app-engine-accounts.csv");

		fastCsv.parseFile(fileName)
			.on("data", data => {
				var accountNo = data[2];

				accounts[accountNo] = {
					accountName: data[1]
				};
			})
			.on("end", rowCount => {
				console.log("Loaded " + Object.keys(accounts).length + " accounts.");
				resolve(accounts);
			});
	});

	return promise;
};

var loadInstancesAndAccounts = function(instanceType) {
    var promise = new Promise((resolve, reject) => {

		loadInstanceData(instanceType)
            .then((instances) => {
                loadAccountData().then((accounts) => {

                    for(var instanceName in instances){
                        var instance = instances[instanceName];
                        if(instance.accountNo && accounts[instance.accountNo])
                            instance.isAppEngineSubscriber = true;
                    }

                    resolve(instances);
                });
            });
	});

	return promise;
};

var loadFileWithInstancesAndAccounts = function(fileName) {
    var promise = new Promise((resolve, reject) => {

		loadInstancesAndAccounts()
            .then((instances) => {
                //
                // Load actual audit
                //
                parseCsvFile(fileName).then((auditData) => {
                    //
                    // Add instance/account info to each row
                    //
                    auditData.forEach((row) => {
                        row.instance = instances[row.instanceName];
                    });
                    
                    resolve(auditData);
                });
            });
	});

	return promise;
};

var parseCsvFile = (fileName) => {

    var auditData = [];

	var parsePayload = function(payload) {
		if(payload && payload.length && payload != EMPTY_PAYLOAD) {
			if(payload.startsWith("*** Script: ")) {
				var jsonString = payload.substring(11);
				try { return JSON.parse(jsonString); } catch(e) {  }
			}
		}
	};

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
		.on("end", rowCount => {
            console.log("Parsed " + auditData.length + " rows from " + fileName);
            resolve(auditData);
        });
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

exports.parseCsvFile = parseCsvFile;
exports.loadInstanceData = loadInstanceData;
exports.loadAccountData = loadAccountData;
exports.loadInstancesAndAccounts = loadInstancesAndAccounts;
exports.loadFileWithInstancesAndAccounts = loadFileWithInstancesAndAccounts;