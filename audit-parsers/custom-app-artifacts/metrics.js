
const path = require('path');
const FileLoader = require('../common/FileLoader.js');
const ExcelJS = require('exceljs');
const fastCsv = require("fast-csv");
const moment = require("moment");
var _ = require('lodash');

var CREATOR_PRO_OBJECTS = [
    "sys_hub_flow",
    "sys_pd_process_definition",
    "sc_cat_item",
    "sc_cat_item_producer",
    "sys_app_template_spoke_configuration",
    "sys_ux_app_config"
];

var CREATOR_CODE_OBJECTS = [
    "sys_script",
    "sys_data_source",
    "sys_ux_client_script",
    "sys_script_include",
    "sys_script_client",
    "sys_ui_action",
    "sys_security_acl",
    "sys_script_email",
    "sp_widget",
    "sys_transform_entry",
    "sys_script_fix",
    "sys_transform_script",
    "sc_cat_item_producer",
    "sp_instance",
    "sysauto_script",
    "sysevent_email_action",
    "sysevent_in_email_action",
    "sys_ui_policy",
    "sys_transform_map",
    "user_criteria",
    "sys_ws_operation",
    "sys_relationship",
    "sys_ui_page",
    "sysevent_script_action",
    "asmt_metric",
    "sys_dictionary",
    "sys_ui_script",
    "sys_ui_list_control",
    "wf_element_activity",
    "cmn_map_page",
    "sp_angular_provider",
    "sys_processor",
    "ecc_agent_script_include",
    "sp_search_source",
    "em_alert_correlation_rule"
];

(function(){

    var fileName = path.join(__dirname, "artifacts.json");

    FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

        var yearsAgo = moment().subtract(1, "years");
        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "metric-app-artifacts-1.xlsx"
        });

        var wsObjects = wb.addWorksheet("Creator Pro+ - Artifacts");
        var wsCode = wb.addWorksheet("Code - Artifacts");

        wsObjects.columns = [
            { header: 'Instance', key: 'instance', width: 20 },
            { header: 'Purpose', key: 'purpose', width: 18 },
            { header: 'Artifact', key: 'key', width: 28 },
            { header: 'Count', key: 'count', width: 10 }
        ];

        wsCode.columns = [
            { header: 'Instance', key: 'instance', width: 20 },
            { header: 'Purpose', key: 'purpose', width: 18 },
            { header: 'Artifact', key: 'key', width: 28 },
            { header: 'Count', key: 'count', width: 10 }
        ];

        auditData.forEach((row) => {
            if(row.data && row.data.customAppArtifacts && row.data.customAppArtifacts.artifacts) {
                var artifactKeys = {};
                var artifacts = {};
                
                for(var tableName in row.data.customAppArtifacts.artifactKeys){
                    var key = row.data.customAppArtifacts.artifactKeys[tableName];
                    artifactKeys[key] = tableName;
                }

                if(row.instance.purpose == 'Production' || row.instance.purpose == 'Subproduction') {
                    for(var scope in row.data.customAppArtifacts.artifacts){
                        var app = row.data.customAppArtifacts.artifacts[scope];

                        if(moment(app.createdOn).isSameOrAfter(yearsAgo)) {
                            for(var artifactKey in app.artifacts){
                                var artifact = artifactKeys[artifactKey];

                                if(artifacts[artifact] == undefined){
                                    artifacts[artifact] = 0;
                                }

                                artifacts[artifact] += app.artifacts[artifactKey];
                            }
                        }
                    }

                    for(var artifact in artifacts) {

                        if(CREATOR_PRO_OBJECTS.indexOf(artifact) > -1) {
                            wsObjects.addRow([
                                row.instanceName, 
                                row.instance.purpose, 
                                artifact, 
                                artifacts[artifact]]).commit();
                        } else if(CREATOR_CODE_OBJECTS.indexOf(artifact) > -1) {
                            wsCode.addRow([
                                row.instanceName, 
                                row.instance.purpose, 
                                artifact, 
                                artifacts[artifact]]).commit();
                        }
                    }
                }
            }
        });

        wb.commit().then(() => {
            console.log("Created file");
        });

    });

})();