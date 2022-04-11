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
        var fileName = path.join(__dirname, "all-customer-accounts.csv");

		fastCsv.parseFile(fileName)
			.on("data", data => {
				var accountNo = data[0];

				accounts[accountNo] = {
					accountName: data[1],
                    accountNo: accountNo,
                    primarySalesRep: data[2],
                    solutionConsultant: data[3],
                    city: data[5],
                    country: data[6],
                    totalACV: data[10],
                    accountType: data[11],
                    isAppEngineSubscriber: false
				};

			})
			.on("end", rowCount => {
                console.log("Loaded " + Object.keys(accounts).length + " total accounts.");

                loadAppEngineAccounts(accounts).then((a) => {
                    resolve(a);
                });
			});
	});

	return promise;
};

var loadAppEngineAccounts = (accounts) => {
	var promise = new Promise((resolve, reject) => {
        var appEngineAccounts = 0;
        var fileName = path.join(__dirname, "app-engine-accounts.csv");

		fastCsv.parseFile(fileName)
			.on("data", data => {
				var accountNo = data[0],
                    account = accounts[accountNo];

                if(account) {
                    account.isAppEngineSubscriber = true;
                    appEngineAccounts++;
                } else {
                    console.log("Could not find App Engine account " + accountNo);
                }
			})
			.on("end", rowCount => {
				console.log("Identified " + appEngineAccounts + " App Engine Accounts.");
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
                        var account = accounts[instance.accountNo];

                        if(account == undefined) {
                            account = {
                                accountName: "",
                                accountNo: instance.accountNo,
                                primarySalesRep: "",
                                solutionConsultant: "",
                                city: "",
                                country: "",
                                totalACV: "",
                                accountType: "",
                                isAppEngineSubscriber: false
                            };
                        }
                        
                        instance.isAppEngineSubscriber = (instance.isAppEngineSubscriber || (account.isAppEngineSubscriber == true));
                        instance.account = account;
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
        var response = {
            success: false
        };

		if(payload && payload.length && payload != EMPTY_PAYLOAD) {
            var index = payload.lastIndexOf("*** Script:");

            if(index != -1) {
                var jsonString = payload.substring(index + 12);

                try { 
                    response.data = JSON.parse(jsonString);
                    response.success = true;
                } catch(e) {  
                    response.errorMessage = e.message;
                }
            } else {
                response.errorMessage = EMPTY_PAYLOAD;
            }
            
		} else {
            response.errorMessage = EMPTY_PAYLOAD;
        }

        return response;
	};

	var promise = new Promise((resolve, reject) => {
		fastCsv.parseFile(fileName).on("data", data => {
			var row = {
				instanceName: data[2],
				auditState: data[0],
				errorDescription: data[1],
				success: (data[0] == AUDIT_STATE_COMPLETED)
			};

            var response = parsePayload(data[3]);

            if(response.success) {
                row.data = response.data;
                row.success = true;
            } else {
                row.success = false;
                row.errorDescription = response.errorMessage;
            }

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