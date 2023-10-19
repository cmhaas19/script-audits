const path = require('path');
const Audit = require('../common/AuditWorkbook.js');
const FileLoader = require('../common/FileLoader.js');
const moment = require("moment");

(function(){

    var fileName = path.join(__dirname, "results-servicenow.csv");       

    FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

        var wb = new Audit.AuditWorkbook("licensing-results-servicenow.xlsx");
        var ws = wb.addWorksheet("Licenses");

        

        ws.setStandardColumns([
            { header: 'Product Code + Name', width: 20 },
            { header: 'Name', width: 20 },
            { header: 'Start Date', width: 20 },
            { header: 'End Date', width: 20 },
            { header: 'Table Count', width: 20 },
            { header: 'Tables Used', width: 20 },
            { header: 'Product Code', width: 20 },
            { header: 'Allocated', width: 20 },
            { header: 'Allocated Status', width: 20 },
            { header: 'Expired', width: 20 },
            { header: 'Created On', width: 20 },
            { header: 'App Engine', width: 20 },
            { header: 'Business Stakeholder', width: 20 }
        ]);

        /*
        {
         "name":"IT Service Management Standard - Fulfiller User v3",
         "startDate":"2023-03-14",
         "endDate":"2026-03-13",
         "tableCount":"25",
         "tablesUsed":"0",
         "productCode":"PROD17243",
         "allocated":"135",
         "allocatedStatus":"under",
         "expired":"0",
         "createdOn":""
      },
        */

        var isOfType = (licenseName, licenseType) => {
            var isType = false;
            
            if(licenseName != undefined && licenseName != null)
                isType = licenseName.toLowerCase().includes(licenseType.toLowerCase());

            return isType;
        };

        auditData.forEach((row) => {
            if(row.data && row.data.licenses && row.data.licenses.length) {
                row.data.licenses.forEach((license) => {
                    ws.addStandardRow(row.instanceName, row.instance, {
                        codePlusName: `${license.productCode} - ${license.name}`,
                        name: license.name,
                        startDate: license.startDate,
                        endDate: license.endDate,
                        tableCount: license.tableCount,
                        tablesUsed: license.tablesUsed,
                        productCode: license.productCode,
                        allocated: license.allocated,
                        allocatedStatus: license.allocatedStatus,
                        expired: license.expired,
                        createdOn: license.createdOn,
                        appEngine: isOfType(license.name, "App Engine"),
                        businessStakeholder: isOfType(license.name, "Business Stakeholder"),
                    });

                });
            }
        });

        wb.commit().then(() => console.log("Finished!"));

    });

})();