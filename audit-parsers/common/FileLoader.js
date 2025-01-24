const fs = require('fs');
const path = require('path');
const fastCsv = require("fast-csv");
const EMPTY_PAYLOAD = "Empty Payload";
const AUDIT_STATE_COMPLETED = "Completed";
const AUDIT_STATE_FAILED = "Failed";
const CUSTOMER_ACCOUNTS_FILENAME = "files/all-customer-accounts.csv";
const CUSTOMER_ACV_FILENAME = "files/all-customer-accounts-acv.csv";
const APP_ENGINE_ACCOUNTS_FILENAME = "files/app-engine-accounts.csv";
const CUSTOMER_INSTANCES_FILENAME = "files/customer-instances.csv";

var loadInstanceData = () => {
	var promise = new Promise((resolve, reject) => {

		var instances = {};
        var fileName = path.join(__dirname, CUSTOMER_INSTANCES_FILENAME);

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
                    subCategory: data[6],
                    usesOracle: (data[7] == "true")
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
        var fileName = path.join(__dirname, CUSTOMER_ACCOUNTS_FILENAME);

        

		fastCsv.parseFile(fileName)
			.on("data", data => {
				var accountNo = data[0];

				accounts[accountNo] = {
					accountName: data[1],
                    accountNo: accountNo,
                    primarySalesRep: data[3],
                    solutionConsultant: data[4],
                    city: "",
                    country: "",
                    totalACV: 0,
                    accountType: data[2],
                    isAppEngineSubscriber: false
				};

			})
			.on("end", rowCount => {
                console.log("Loaded " + Object.keys(accounts).length + " total accounts.");

                loadAccountAcv(accounts)
                    .then((a) => loadAppEngineAccounts(a))
                    .then((a) => resolve(a));
			});
	});

	return promise;
};


var loadAccountAcv = (accounts) => {
	var promise = new Promise((resolve, reject) => {
        var fileName = path.join(__dirname, CUSTOMER_ACV_FILENAME);
        var acvAccounts = 0;

        var parseACV = function(text) {
            if(text.trim().length == 0)
                return 0;

            var acv = parseFloat(text.replace(/,/g, ''));

            if(isNaN(acv))
                return 0;

            return acv;
        };

		fastCsv.parseFile(fileName)
			.on("data", data => {
				var accountNo = data[0],
                    account = accounts[accountNo];

                if(account) {
                    var acv = parseACV(data[2]);
                    account.totalACV = (acv > 0 ? acv : 0);
                    acvAccounts++;
                } else {
                    console.log("Could not find ACV account " + accountNo);
                }
			})
			.on("end", rowCount => {
				console.log("Found " + acvAccounts + " ACV Accounts.");
				resolve(accounts);
			});
	});

	return promise;
};

var loadAppEngineAccounts = (accounts) => {
	var promise = new Promise((resolve, reject) => {
        var appEngineAccounts = 0;
        var fileName = path.join(__dirname, APP_ENGINE_ACCOUNTS_FILENAME);

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
                                totalACV: 0,
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
                parseFile(fileName).then((auditData) => {
                    //
                    // Add instance/account info to each row
                    //
                    auditData.forEach((row) => {
                        var instance = instances[row.instanceName];

                        if(instance == undefined){
                            instance = {
                                customer: "",
                                accountNo: "",
                                version: "",
                                purpose: "",
                                category: "",
                                subCategory: "",
                                usesOracle: false,
                                account: {
                                    accountName: "",
                                    accountNo: "",
                                    primarySalesRep: "",
                                    solutionConsultant: "",
                                    city: "",
                                    country: "",
                                    totalACV: 0,
                                    accountType: "",
                                    isAppEngineSubscriber: false
                                }
                            }
                            //console.log(`Could not find instance ${row.instanceName}`);
                        }
                        row.instance = instance;
                    });
                    
                    resolve(auditData);
                });
            });
	});

	return promise;
};

var parseFile = (fileName) => {

    const parsePayload = (payload) => {
        const response = {
            success: false,
            errorMessage: EMPTY_PAYLOAD
        };

        if (payload && payload.length && payload !== EMPTY_PAYLOAD) {
            const index = payload.lastIndexOf("*** Script:");

            if (index !== -1) {
                const jsonString = payload.substring(index + 12);

                try {
                    response.data = JSON.parse(jsonString);
                    response.success = true;
                    response.errorMessage = "";
                } catch (e) {
                    response.errorMessage = e.message;
                }
            }
        }

        return response;
    };

    var parseJsonFile = (fileName) => {
        return new Promise((resolve, reject) => {
            console.log(`Starting to process file ${fileName}`);

            var data = fs.readFileSync(fileName, 'utf8');
            var jsonData = "";

            if(data && data.length) {
                jsonData = JSON.parse(data);
            }

            if(jsonData && jsonData.records) {
                jsonData.records.forEach((record) => {
                    var row = {
                        instanceName: record.u_instance_name,
                        auditState: record.u_audit_state,
                        errorDescription: record.u_error_description,
                        success: (record.u_audit_state == AUDIT_STATE_COMPLETED)
                    };

                    if (row.auditState == AUDIT_STATE_FAILED) {
                        row.errorDescription = record.u_error_description;
                    } else {
                        var response = parsePayload(record.u_audit_payload);
    
                        if (response.success) {
                            row.data = response.data;
                            row.success = true;
                        } else {
                            row.success = false;
                            row.errorDescription = response.errorMessage;
                        }
                    }
    
                    auditData.push(row);
                });
            }

            resolve(auditData);
        });
    };

    var parseCsvFile = (fileName) => {
        return new Promise((resolve, reject) => {
            console.log(`Starting to process file ${fileName}`);
    
            fastCsv.parseFile(fileName)
                .on("data", data => {
                    var row = {
                        instanceName: data[2],
                        auditState: data[0],
                        errorDescription: data[1],
                        success: (data[0] == AUDIT_STATE_COMPLETED)
                    };
    
                    if (row.auditState == AUDIT_STATE_FAILED) {
                        row.errorDescription = data[1];
                    } else {
                        var response = parsePayload(data[3]);
    
                        if (response.success) {
                            row.data = response.data;
                            row.success = true;
                        } else {
                            row.success = false;
                            row.errorDescription = response.errorMessage;
                        }
                    }
    
                    auditData.push(row);
                })
                .on("end", () => {
                    console.log(`Parsed ${auditData.length} rows from ${fileName}`);
                    resolve(auditData);
                })
                .on("error", error => {
                    console.error(`Error processing file ${fileName}: ${error.message}`);
                    reject(error);
                });
        });
    };

    var auditData = [];

    const fileExtension = path.extname(fileName).toLowerCase();

    switch (fileExtension) {
        case '.csv':
            return parseCsvFile(fileName);
            break;
        case '.json':
            return parseJsonFile(fileName);
            break;
        default:
            throw new Error(`Unsupported file extension: ${fileExtension}`);
    }
};

var parseCsvFile = (fileName) => {
    return parseFile(fileName);
};

exports.parseFile = parseFile;
exports.parseCsvFile = parseCsvFile;
exports.loadInstanceData = loadInstanceData;
exports.loadAccountData = loadAccountData;
exports.loadInstancesAndAccounts = loadInstancesAndAccounts;
exports.loadFileWithInstancesAndAccounts = loadFileWithInstancesAndAccounts;