
const path = require('path');
const sharedData = require('../shared/shared');
const ExcelJS = require('exceljs');
const fastCsv = require("fast-csv");

(function(){

    var fileName = path.join(__dirname, "results.csv");

    sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
        var scopes = {};
        var artifacts = {};
        
        //
        // Loop through and aggregate by scope to ensure we don't double count the same apps
        //
        auditData.forEach((row) => {
            if(row.data && row.data.customAppArtifacts && row.instance && row.instance.purpose.length) {

                var instancePurpose = row.instance.purpose;
                
                for(var scope in row.data.customAppArtifacts){
                    var app = row.data.customAppArtifacts[scope];

                    if(scopes[scope] == undefined || instancePurpose == 'Production') {
                        scopes[scope] = {};

                        for(var artifact in app){
                            scopes[scope][artifact] = app[artifact];
                        }

                        scopes[scope].instance = {
                            name: row.instanceName,
                            purpose: row.instance.purpose,
                            customer: row.instance.customer
                        };
                    }
                }
            }
        });

        //console.log(scopes);

        console.log("Found " + Object.keys(scopes).length + " unique scopes");

        //
        // Now, loop through and aggregate by artifact type
        //
        for(var scope in scopes){
            var app = scopes[scope];

            for(var artifact in app) {
                if(artifact == "instance")
                    continue;

                if(artifacts[artifact] == undefined){
                    artifacts[artifact] = { totalArtifacts: 0, totalApps: 0};
                }
                artifacts[artifact].totalArtifacts += app[artifact];
                artifacts[artifact].totalApps++;
            }
        }

        console.log("Found " + Object.keys(artifacts).length + " unique artifacts");

        //
        // Now, let's write the data
        //
        var wb = new ExcelJS.Workbook();

        (function(){
            var worksheet = wb.addWorksheet("Artifacts - Roll-Up");            

            worksheet.columns = [
                { header: 'Artifact', key: 'artifact', width: 40 },
                { header: 'Total Apps', key: 'apps', width: 15 },
                { header: 'Total Artifacts', key: 'count', width: 15 }
            ];

            for(var artifact in artifacts) {
                worksheet.addRow([artifact, artifacts[artifact].totalApps, artifacts[artifact].totalArtifacts]);
            }
        })();

        (function(){
            var worksheet = wb.addWorksheet("Artifacts - All");            

            worksheet.columns = [
                { header: 'Instance', key: 'instance', width: 40 },
                { header: 'Purpose', key: 'purpose', width: 40 },
                { header: 'Customer', key: 'customer', width: 40 },
                { header: 'Scope', key: 'scope', width: 40 },
                { header: 'Artifact', key: 'artifact', width: 40 },
                { header: 'Count', key: 'count', width: 40 }
            ];

            for(var scope in scopes){
                var app = scopes[scope];
    
                for(var artifact in app) {
                    if(artifact != "instance")
                        worksheet.addRow([app.instance.name, app.instance.purpose, app.instance.customer, scope, artifact, app[artifact]]);
                }
            }
        })();

        var resultsFileName = "custom-app-artifacts.xlsx";        

        wb.xlsx.writeFile(resultsFileName).then(() => {
            console.log("Created file " + resultsFileName);
        });
    });

})();