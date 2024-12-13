
const path = require('path');
const FileLoader = require('../common/FileLoader.js');
const ExcelJS = require('exceljs');
const fastCsv = require("fast-csv");
const moment = require("moment");
var _ = require('lodash');

var loadPackages = () => {
    var fileName = path.join(__dirname, "packages.json");

    var promise = new Promise((resolve, reject) => {
        FileLoader.parseFile(fileName).then((auditData) => {
            var packages = {};
    
            auditData.forEach((row) => {
                if(row.data && row.data.currentLanguage && row.data.currentLanguage == "en") {
                    for(var tableName in row.data.artifactPackages) {
                        if(packages[tableName] == undefined){
                            packages[tableName] = row.data.artifactPackages[tableName];
                        }
                    }
                }
                resolve(packages);
            });
        });
    });

    return promise;
};

var isCustomArtifact = (artifact) => {
    if(artifact == undefined || artifact == null || artifact.length == 0)
        return "N/A";
    
        var isCustom = artifact.startsWith("u_") || artifact.startsWith("x_");

        return (isCustom ? "Yes" : "No");
};

(function(){

    //
    // Load packages
    //
    loadPackages().then((packages) => {
        var fileName = path.join(__dirname, "artifacts.json");

        console.log("Found " + Object.keys(packages).length + " packages");

        FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var scopes = {};
            var artifacts = {};
            var yearsAgo = moment().subtract(3, "years");
            
            //
            // Loop through and aggregate by scope to ensure we don't double count the same apps
            //
            auditData.forEach((row) => {
                if(row.data && row.data.customAppArtifacts && row.data.customAppArtifacts.artifacts && row.instance && row.instance.purpose.length) {
                    var artifactKeys = {};
                    
                    for(var tableName in row.data.customAppArtifacts.artifactKeys){
                        var key = row.data.customAppArtifacts.artifactKeys[tableName];
                        artifactKeys[key] = tableName;
                    }
    
                    var instancePurpose = row.instance.purpose;

                    if(instancePurpose == 'Production') {
                    
                        for(var scope in row.data.customAppArtifacts.artifacts){
                            var app = row.data.customAppArtifacts.artifacts[scope];
        
                            if(moment(app.createdOn).isSameOrAfter(yearsAgo)) {
                                if(scopes[scope] == undefined || instancePurpose == 'Production') {
                                    scopes[scope] = {
                                        artifacts: {},
                                        instance: { name: "", purpose: "", customer: "" },
                                        createdOn: app.createdOn
                                    };
            
                                    for(var artifactKey in app.artifacts){
                                        var artifact = artifactKeys[artifactKey];
                                        scopes[scope].artifacts[artifact] = app.artifacts[artifactKey];
                                    }

                                    scopes[scope].instance.name = row.instanceName;
                                    scopes[scope].instance.purpose = row.instance.purpose;
                                    scopes[scope].instance.customer = row.instance.customer;
                                }
                            }
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

                for(var artifact in app.artifacts) {
                    if(artifacts[artifact] == undefined){
                        artifacts[artifact] = { totalArtifacts: 0, totalApps: 0};
                    }
                    artifacts[artifact].totalArtifacts += app.artifacts[artifact];
                    artifacts[artifact].totalApps++;
                }
            }
    
            console.log("Found " + Object.keys(artifacts).length + " unique artifacts");

    
            //
            // Now, let's write the data
            //
            var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
                filename: "custom-app-artifacts.xlsx"
            });
    
            (function(){
                var worksheet = wb.addWorksheet("Artifacts - Roll-Up");            
    
                worksheet.columns = [
                    { header: 'Artifact', key: 'artifact', width: 40 },
                    { header: 'Artifact Label', key: 'artifact', width: 40 },
                    { header: 'Artifact Package', key: 'artifact', width: 40 },
                    { header: 'Total Apps', key: 'apps', width: 15 },
                    { header: 'Total Artifacts', key: 'count', width: 15 }
                ];
    
                for(var artifact in artifacts) {
                    var table = packages[artifact],
                        pkg = "",
                        lbl = "";

                    if(table != undefined) {
                        pkg = table.pkg;
                        lbl = table.lbl;
                    }

                    worksheet.addRow([artifact, lbl, pkg, artifacts[artifact].totalApps, artifacts[artifact].totalArtifacts]).commit();
                }

                worksheet.commit();

                console.log("Processed roll-up worksheet");
            })();
    
            (function(){
                var worksheet = wb.addWorksheet("Artifacts - All");    
                var rowCount = 0;        
    
                worksheet.columns = [
                    { header: 'Instance', key: 'instance', width: 20 },
                    { header: 'Purpose', key: 'purpose', width: 18 },
                    { header: 'Customer', key: 'customer', width: 28 },
                    { header: 'Key', key: 'key', width: 28 },
                    { header: 'Scope', key: 'scope', width: 22 },
                    { header: 'Scope Created', key: 'sc', width: 20 },
                    { header: 'Scope Created YYYY-MM', key: 'scy', width: 20 },
                    { header: 'Artifact', key: 'artifact', width: 40 },
                    { header: 'Artifact Label', key: 'lbl', width: 40 },
                    { header: 'Artifact Package', key: 'pkg', width: 40 },
                    { header: 'Artifact Is Custom', key: 'custom', width: 40 },
                    { header: 'Count', key: 'count', width: 10 }
                ];
    
                for(var scope in scopes){
                    var app = scopes[scope];
        
                    for(var artifact in app.artifacts) {
                        var table = packages[artifact],
                            pkg = "",
                            lbl = "";

                        if(table != undefined) {
                            pkg = table.pkg;
                            lbl = table.lbl;
                        }

                        worksheet.addRow([
                            app.instance.name, 
                            app.instance.purpose, 
                            app.instance.customer, 
                            app.instance.name + "-" + scope,
                            scope, 
                            app.createdOn, 
                            moment(app.createdOn).format("YYYY-MM"), 
                            artifact, 
                            lbl, 
                            pkg, 
                            isCustomArtifact(artifact),
                            app.artifacts[artifact]]).commit();  
                        
                            rowCount++;
                    }
                }

                worksheet.commit();

                console.log("Processed all artifacts worksheet. Rows: " + rowCount);

            })();

            wb.commit().then(() => {
                console.log("Created file");
            });

        });
    });
})();