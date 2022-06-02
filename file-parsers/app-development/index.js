
const path = require('path');
const sharedData = require('../shared/shared');
const ExcelJS = require('exceljs');
const moment = require("moment");

var generateColumns = (values) => {
    var columns = [
        { header: 'Instance Name', width: 22 },
        { header: 'Company', width: 16 },
        { header: 'Account No.', width: 13 },
        { header: 'Instance Version', width: 22 },
        { header: 'Instance Purpose', width: 16 },
    ];

    return columns.concat(values);
};

var generateRowValues = (instanceName, instance, values) => {
    var rowValues = [];

    if(instance)
        rowValues = [instanceName, instance.customer, instance.accountNo, instance.version, instance.purpose];
    else
        rowValues = [instanceName,"","","",""];

    return rowValues.concat(values);
};

var processTables = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "custom-tables.xlsx"
        });

        var fileName = path.join(__dirname, "audits", "tables.csv");       

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var tableWs = wb.addWorksheet("Tables");
            var fieldsWs = wb.addWorksheet("Tables - Field Types");
            var referenceWs = wb.addWorksheet("Tables - Reference Tables");
            var overridesWs = wb.addWorksheet("Tables - Overrides");
    
            tableWs.columns = generateColumns([
                { header: 'Scope', width: 20 },
                { header: 'Table Name', width: 40 },
                { header: 'Table Label', width: 40 },
                { header: 'Created', width: 18, alignment: { horizontal: 'right' } },
                { header: 'Created YYYY-MM', width: 15, alignment: { horizontal: 'right' } },
                { header: 'Extends Table', width: 30 },
                { header: 'Extensible', width: 10 },
                { header: 'Field Count', width: 10, alignment: { horizontal: 'right' } },
                { header: 'Auto Number - Prefix', width: 20 },
                { header: 'Auto Number - Number', width: 20 },
                { header: 'Auto Number - Max Digits', width: 20 },
                { header: 'Mandatory Fields - Dictionary', width: 24, alignment: { horizontal: 'right' } },
                { header: 'Mandatory Fields - Data Policy', width: 24, alignment: { horizontal: 'right' } }
            ]);

            fieldsWs.columns = [
                { header: 'Scope', width: 20 },
                { header: 'Table Name', width: 40 },
                { header: 'Field Type', width: 20 },
                { header: 'Count', width: 20, alignment: { horizontal: 'right' } }
            ];

            referenceWs.columns = [
                { header: 'Scope', width: 20 },
                { header: 'Table Name', width: 40 },
                { header: 'Reference Table', width: 25 },
                { header: 'Count', width: 20, alignment: { horizontal: 'right' } }
            ];

            overridesWs.columns = [
                { header: 'Instance Name', width: 22 },
                { header: 'Instance Purpose', width: 16 },
                { header: 'Scope', width: 20 },
                { header: 'Table Name', width: 40 },
                { header: 'Base Table', width: 40 },
                { header: 'Field Name', width: 20 },
                { header: 'Attributes', width: 12 },
                { header: 'Attributes Override', width: 12 },
                { header: 'Calculation', width: 12 },
                { header: 'Calculation Override', width: 12 },
                { header: 'Default value', width: 12 },
                { header: 'Default value Override', width: 12 },
                { header: 'Dependent', width: 12 },
                { header: 'Dependent Override', width: 12 },
                { header: 'Display Override', width: 12 },
                { header: 'Mandatory', width: 12 },
                { header: 'Mandatory Override', width: 12 },
                { header: 'Read only', width: 12 },
                { header: 'Read only Override', width: 12 },
                { header: 'Reference qual', width: 12 },
                { header: 'Reference qual Override', width: 12 }
            ];
            
            auditData.forEach((row) => {

                if(row.data && row.data.customTables) {
                    for(var tableName in row.data.customTables){

                        var table = row.data.customTables[tableName];
                        var autoNumber = (table.autoNumber != undefined);   
                        var mandatory = (table.mandatory != undefined);
                        
                        tableWs.addRow(
                            generateRowValues(row.instanceName, row.instance, [
                                table.scope, 
                                tableName, 
                                table.label, 
                                table.createdOn, 
                                moment(table.createdOn).format("YYYY-MM"),
                                table.extendsTable, 
                                table.extensible,
                                table.fieldCount,
                                (autoNumber ? table.autoNumber.prefix : ""),
                                (autoNumber ? table.autoNumber.number : ""),
                                (autoNumber ? table.autoNumber.maximumDigits : ""),
                                (mandatory ? (table.mandatory.dictionary != undefined ? table.mandatory.dictionary : 0) : 0),
                                (mandatory ? (table.mandatory.dataPolicy != undefined ? table.mandatory.dataPolicy : 0) : 0)])).commit();

                        //
                        // Field Types
                        //
                        for(var fieldType in table.fieldTypes) {
                            fieldsWs.addRow([
                                    table.scope, 
                                    tableName, 
                                    fieldType, 
                                    table.fieldTypes[fieldType]]).commit();
                        }

                        //
                        // Reference Tables
                        //
                        for(var refTableName in table.referenceTables) {
                            referenceWs.addRow([
                                    table.scope, 
                                    tableName, 
                                    refTableName, 
                                    table.referenceTables[refTableName]]).commit();
                        }

                        //
                        // Overrides
                        //
                        if(table.overrides && table.overrides.length) {
                            table.overrides.forEach((override) => {
                                overridesWs.addRow([
                                    row.instanceName,
                                    (row.instance != undefined ? row.instance.purpose : ""),
                                    table.scope, 
                                    override.name, 
                                    override.base_table,
                                    override.element, 
                                    override.attributes, 
                                    override.attributes_override, 
                                    override.calculation, 
                                    override.calculation_override, 
                                    override.default_value, 
                                    override.default_value_override, 
                                    override.dependent, 
                                    override.dependent_override, 
                                    override.display_override, 
                                    override.mandatory, 
                                    override.mandatory_override, 
                                    override.read_only, 
                                    override.read_only_override, 
                                    override.reference_qual, 
                                    override.reference_qual_override]).commit();
                            });
                        }
                    }
                }
            });

            tableWs.commit();
            fieldsWs.commit();
            referenceWs.commit();
            overridesWs.commit();
            
            wb.commit().then(() => {
                console.log("Completed tables");
                resolve();
            });

        });

    });

    return promise;
};

var processBusinessRules = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "custom-business-rules.xlsx"
        });

        var fileName = path.join(__dirname, "audits", "business-rules.csv");       

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var worksheet = wb.addWorksheet("Business Rules");
    
            worksheet.columns = generateColumns([
                { header: 'Scope', width: 20 },
                { header: 'Name', width: 20 },
                { header: 'Table Name', width: 40 },
                { header: 'Created', width: 18, alignment: { horizontal: 'right' } },
                { header: 'Created YYYY-MM', width: 15, alignment: { horizontal: 'right' } },
                { header: 'Advanced', width: 8 },
                { header: 'Script Condition Length', width: 10, alignment: { horizontal: 'right' } },
                { header: 'Script Length', width: 10, alignment: { horizontal: 'right' } },
                { header: 'When', width: 20 },
                { header: 'Filter Conditions', width: 20 },
                { header: 'Role Conditions', width: 20 },
                { header: 'On Delete', width: 12 },
                { header: 'On Insert', width: 12 },
                { header: 'On Query', width: 12 },
                { header: 'On Update', width: 12 },
                { header: 'Set Field Values', width: 20 },
                { header: 'Add Message', width: 10 },
                { header: 'Abort Action', width: 10 },
            ]);
            
            auditData.forEach((row) => {

                if(row.data && row.data.customBusinessRules) {
                    row.data.customBusinessRules.forEach((br) => {
                        worksheet.addRow(
                            generateRowValues(row.instanceName, row.instance, [
                                br.scope,
                                br.name,
                                br.tableName,
                                br.createdOn,
                                moment(br.createdOn).format("YYYY-MM"),
                                br.advanced,
                                br.scriptConditionLength,
                                br.scriptLength,
                                br.whenToRun.when,
                                br.whenToRun.filterConditions,
                                br.whenToRun.roleConditions,
                                br.whenToRun.triggers.onDelete,
                                br.whenToRun.triggers.onInsert,
                                br.whenToRun.triggers.onQuery,
                                br.whenToRun.triggers.onUpdate,
                                br.actions.setFieldValues,
                                br.actions.addMessage,
                                br.actions.abortAction])).commit();
                    });
                }
            });

            worksheet.commit();
            
            wb.commit().then(() => {
                console.log("Completed business rules");
                resolve();
            });

        });

    });

    return promise;
};

var processDataSources = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "custom-data-sources.xlsx"
        });

        var fileName = path.join(__dirname, "audits", "data-sources.csv");       

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var worksheet = wb.addWorksheet("Data Sources");
    
            worksheet.columns = generateColumns([
                { header: 'Scope', width: 20 },
                { header: 'Name', width: 20 },
                { header: 'Table Name', width: 40 },
                { header: 'Created', width: 18, alignment: { horizontal: 'right' } },
                { header: 'Created YYYY-MM', width: 15, alignment: { horizontal: 'right' } },
                { header: 'File Path', width: 20 },
                { header: 'File Retrieval Method', width: 12 },
                { header: 'Format', width: 10 },
                { header: 'Sheet Number', width: 10, alignment: { horizontal: 'right' } },
                { header: 'Type', width: 10 },
                { header: 'Zipped', width: 10 }
            ]);
            
            auditData.forEach((row) => {

                if(row.data && row.data.customDataSources) {
                    row.data.customDataSources.forEach((item) => {
                        worksheet.addRow(
                            generateRowValues(row.instanceName, row.instance, [
                                item.scope,
                                item.name,
                                item.tableName,
                                item.createdOn,
                                moment(item.createdOn).format("YYYY-MM"),
                                item.filePath,
                                item.fileRetrievalMethod,
                                item.format,
                                item.sheetNumber,
                                item.type,
                                item.zipped])).commit();
                    });
                }
            });

            worksheet.commit();
            
            wb.commit().then(() => {
                console.log("Completed data sources");
                resolve();
            });

        });

    });

    return promise;
};

var processRoles = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "custom-roles.xlsx"
        });

        var fileName = path.join(__dirname, "audits", "roles.csv");       

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var worksheet = wb.addWorksheet("Roles");
    
            worksheet.columns = generateColumns([
                { header: 'Scope', width: 20 },
                { header: 'Full Name', width: 20 },
                { header: 'Name', width: 20 },
                { header: 'Description', width: 40 },
                { header: 'Created', width: 18, alignment: { horizontal: 'right' } },
                { header: 'Created YYYY-MM', width: 15, alignment: { horizontal: 'right' } },
                { header: 'No. of Users', width: 12, alignment: { horizontal: 'right' } }
            ]);
            
            auditData.forEach((row) => {

                if(row.data && row.data.customRoles) {
                    for(var roleName in row.data.customRoles){
                        var item = row.data.customRoles[roleName];
                        var name = roleName.replace(item.scope + "_", "").replace(item.scope + ".", "");

                        worksheet.addRow(
                            generateRowValues(row.instanceName, row.instance, [
                                item.scope,
                                roleName,
                                name,
                                item.description,
                                item.createdOn,
                                moment(item.createdOn).format("YYYY-MM"),
                                item.users])).commit();
                    }
                }
            });

            worksheet.commit();
            
            wb.commit().then(() => {
                console.log("Completed roles");
                resolve();
            });

        });

    });

    return promise;
};

var processReports = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "custom-reports.xlsx"
        });

        var fileName = path.join(__dirname, "audits", "reports.csv");    

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var worksheet = wb.addWorksheet("Reports");
    
            worksheet.columns = generateColumns([
                { header: 'Scope', width: 20 },
                { header: 'Table', width: 20 },
                { header: 'Title', width: 40 },
                { header: 'Description', width: 40 },
                { header: 'Created', width: 18, alignment: { horizontal: 'right' } },
                { header: 'Created YYYY-MM', width: 15, alignment: { horizontal: 'right' } },
                { header: 'Field', width: 15 },
                { header: 'Field List', width: 20 },
                { header: 'Type', width: 10 },
                { header: 'Chart Size', width: 10 },
                { header: 'User', width: 10 },
                { header: 'Filter', width: 20 },
                { header: 'Roles', width: 15 },
                { header: 'Is Scheduled?', width: 12 }
            ]);
            
            auditData.forEach((row) => {

                if(row.data && row.data.customReports) {
                    row.data.customReports.forEach((item) => {
                        worksheet.addRow(
                            generateRowValues(row.instanceName, row.instance, [
                                item.scope,
                                item.table,
                                item.title,
                                item.description,
                                item.createdOn,
                                moment(item.createdOn).format("YYYY-MM"),
                                item.field,
                                item.fieldList,
                                item.type,
                                item.chartSize,
                                item.user,
                                item.filter,
                                item.roles,
                                item.isScheduled])).commit();
                    });
                }
            });

            worksheet.commit();
            
            wb.commit().then(() => {
                console.log("Completed reports");
                resolve();
            });

        });

    });

    return promise;
};

var processEventRegistry = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "custom-event-registry.xlsx"
        });

        var fileName = path.join(__dirname, "audits", "event-registry.csv");    

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var worksheet = wb.addWorksheet("Event Registry");
    
            worksheet.columns = generateColumns([
                { header: 'Scope', width: 20 },
                { header: 'Table', width: 20 },
                { header: 'Event Name', width: 40 },
                { header: 'Description', width: 40 },
                { header: 'Created', width: 18, alignment: { horizontal: 'right' } },
                { header: 'Created YYYY-MM', width: 15, alignment: { horizontal: 'right' } },
                { header: 'Fired By', width: 15 },
                { header: 'Queue', width: 20 },
                { header: 'Suffix', width: 10 },
                { header: 'Caller Access', width: 10 }
            ]);
            
            auditData.forEach((row) => {

                if(row.data && row.data.customEvents) {
                    row.data.customEvents.forEach((item) => {
                        worksheet.addRow(
                            generateRowValues(row.instanceName, row.instance, [
                                item.scope,
                                item.table,
                                item.eventName,
                                item.description,
                                item.createdOn,
                                moment(item.createdOn).format("YYYY-MM"),
                                item.firedBy,
                                item.queue,
                                item.suffix,
                                item.callerAccess])).commit();
                    });
                }
            });

            worksheet.commit();
            
            wb.commit().then(() => {
                console.log("Completed event registry");
                resolve();
            });

        });

    });

    return promise;
};

var processScheduledScripts = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "custom-scheduled-scripts.xlsx"
        });

        var fileName = path.join(__dirname, "audits", "scheduled-scripts.csv");    

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var worksheet = wb.addWorksheet("Scheduled Scripts");
    
            worksheet.columns = generateColumns([
                { header: 'Scope', width: 20 },
                { header: 'Name', width: 20 },
                { header: 'Created', width: 18, alignment: { horizontal: 'right' } },
                { header: 'Created YYYY-MM', width: 15, alignment: { horizontal: 'right' } },
                { header: 'Conditional', width: 15 },
                { header: 'Script Condition Length', width: 20 },
                { header: 'Script Length', width: 10 },
                { header: 'Run As', width: 10 },
                { header: 'Run As Value', width: 10 },
                { header: 'Run Type', width: 10 },
                { header: 'Repeat Interval - Day of Month', width: 10 },
                { header: 'Repeat Interval - Day of Week', width: 10 },
                { header: 'Repeat Interval - Period', width: 10 },
                { header: 'Repeat Interval - Start Date', width: 10 },
                { header: 'Repeat Interval - Start Time', width: 10 }
            ]);
            
            auditData.forEach((row) => {

                if(row.data && row.data.customScheduledScripts) {
                    row.data.customScheduledScripts.forEach((item) => {
                        worksheet.addRow(
                            generateRowValues(row.instanceName, row.instance, [
                                item.scope,
                                item.name,
                                item.createdOn,
                                moment(item.createdOn).format("YYYY-MM"),
                                item.conditional,
                                item.scriptConditionLength,
                                item.scriptLength,
                                item.runAs,
                                item.runAsValue,
                                item.runType,
                                item.repeatInterval.dayOfMonth,
                                item.repeatInterval.dayOfWeek,
                                item.repeatInterval.period,
                                item.repeatInterval.startDate,
                                item.repeatInterval.startTime])).commit();
                    });
                }
            });

            worksheet.commit();
            
            wb.commit().then(() => {
                console.log("Completed scheduled scripts");
                resolve();
            });

        });

    });

    return promise;
};

var processSystemProperties = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "custom-system-properties.xlsx"
        });

        var fileName = path.join(__dirname, "audits", "system-properties.csv");       

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var worksheet = wb.addWorksheet("System Properties");
    
            worksheet.columns = generateColumns([
                { header: 'Scope', width: 20 },
                { header: 'Full Name', width: 20 },
                { header: 'Name', width: 20 },
                { header: 'Description', width: 40 },
                { header: 'Created', width: 18, alignment: { horizontal: 'right' } },
                { header: 'Created YYYY-MM', width: 15, alignment: { horizontal: 'right' } },
                { header: 'Value', width: 12 },
                { header: 'Type', width: 12 }
            ]);
            
            auditData.forEach((row) => {

                if(row.data && row.data.customSystemProperties) {
                    for(var propertyName in row.data.customSystemProperties){
                        var item = row.data.customSystemProperties[propertyName];
                        var name = propertyName.replace(item.scope + ".", "");

                        worksheet.addRow(
                            generateRowValues(row.instanceName, row.instance, [
                                item.scope,
                                propertyName,
                                name,
                                item.description,
                                item.createdOn,
                                moment(item.createdOn).format("YYYY-MM"),
                                item.value,
                                item.type])).commit();
                    }
                }
            });

            worksheet.commit();
            
            wb.commit().then(() => {
                console.log("Completed sytem properties");
                resolve();
            });

        });

    });

    return promise;
};


var processTaskFormFields = () => {
    var promise = new Promise((resolve, reject) => {

        var wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: "custom-task-table-form-fields.xlsx"
        });

        var fileName = path.join(__dirname, "audits", "tables-from-task.csv");       

        sharedData.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {
            var worksheet = wb.addWorksheet("Task Form Fields");
    
            worksheet.columns = [
                { header: 'Instance Name', width: 22 },
                { header: 'Company', width: 16 },
                { header: 'Account No.', width: 13 },
                { header: 'Field Name', width: 13 },
                { header: 'Count', width: 13 }
            ];
            
            auditData.forEach((row) => {

                if(row.data && row.data) {
                    for(var fieldName in row.data){
                        if(row.instance) {
                            worksheet.addRow([
                                row.instanceName,
                                row.instance.customer, 
                                row.instance.accountNo,
                                fieldName,
                                row.data[fieldName]
                            ]);
                        } else {
                            worksheet.addRow([
                                row.instanceName,
                                "", 
                                "",
                                fieldName,
                                row.data[fieldName]
                            ]);
                        }
                    }
                }
            });

            worksheet.commit();
            
            wb.commit().then(() => {
                console.log("Completed task form fields");
                resolve();
            });

        });

    });

    return promise;
};

(function(){

    processTaskFormFields().then(() => { console.log("Done") });
    /*
    processTables()
        .then(() => processTaskFormFields()
        .then(() => processSystemProperties()
        .then(() => processScheduledScripts()
        .then(() => processBusinessRules()
        .then(() => processDataSources()
        .then(() => processRoles()
        .then(() => processReports()
        .then(() => processEventRegistry()
        .then(() => { console.log("Done") })))))))));
    */

})();