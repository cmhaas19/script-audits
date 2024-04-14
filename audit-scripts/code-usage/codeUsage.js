
(function(){

    var DATE_RANGE = { startDate: new GlideDateTime("2011-01-01 00:00:00"), endDate: new GlideDateTime("2011-12-31 23:59:59")};
    var TABLES_WITH_SCRIPT_FIELDS = {};
    var UPDATE_NAMES = {};
    var VERSION_RECORDS = {};
    var RESULTS = { log: {}, ommittedRecords: { acl: 0, maint: 0, clientScriptV2: 0 }, tables: {} };

    var StopWatch = function() {
        var start = new GlideDateTime();
    
        return {
            getTime: function() {
                var duration = GlideDateTime.subtract(start, new GlideDateTime());
                return duration.getNumericValue();
            }
        };
    };

    //
    // Initialize date ranges
    //
    var today = new GlideDateTime();
    DATE_RANGE.startDate.setYearUTC((today.getYear() - 1));
    DATE_RANGE.endDate.setYearUTC((today.getYear() - 1));       
    RESULTS.log["DateRanges"] = { s: DATE_RANGE.startDate.getValue(), e: DATE_RANGE.endDate.getValue()};        

    //
    // Get metadata tables with script fields
    //
    (function(){
        var sw = new StopWatch();
        var gr = new GlideRecord("sys_dictionary");
        gr.setWorkflow(false);
        gr.addEncodedQuery("internal_type=script^ORinternal_type=script_client^ORinternal_type=script_plain^ORinternal_type=script_server");
        gr.query();

        while(gr.next()){
            var tableName = gr.getValue("name");
            if (!GlideDBObjectManager.get().isMetadataExtension(tableName)) {
                continue;
            }

            if(TABLES_WITH_SCRIPT_FIELDS[tableName] === undefined){
                TABLES_WITH_SCRIPT_FIELDS[tableName] = [];
            }

            TABLES_WITH_SCRIPT_FIELDS[tableName].push({
                name: gr.getValue("element"),
                tableName: tableName,
                internalType: gr.getValue("internal_type"),
                defaultValue: (gr.getValue("default_value") || "").replace(/\s+/g, "")
            });
        }

        RESULTS.log["GetMetadataTables"] = { queryTime: sw.getTime(), tableCount: Object.keys(TABLES_WITH_SCRIPT_FIELDS).length };

    })();

    //
    // Get the update names of all the records in these tables that have been updated within the given date range
    //
    (function(){
        var sw = new StopWatch();
        var gr = new GlideRecord("sys_metadata");
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_class_nameIN" + Object.keys(TABLES_WITH_SCRIPT_FIELDS).join(","));
        
        var join = gr.addJoinQuery("sys_update_xml", "sys_update_name", "name");
        join.addCondition("sys_created_on", ">=", DATE_RANGE.startDate);
        join.addCondition("sys_created_on", "<=", DATE_RANGE.endDate);
        gr.query();

        while(gr.next()){
            var tableName = gr.getValue("sys_class_name"),
                updateName = gr.getValue("sys_update_name");

            UPDATE_NAMES[updateName] = { 
                tableName: tableName,
                tableFields: TABLES_WITH_SCRIPT_FIELDS[tableName], 
                customerCreatedFile: true,
                createdOn: gr.getValue("sys_created_on")
            };
        }

        RESULTS.log["GetUpdateNames"] = { queryTime: sw.getTime(), updateCount: Object.keys(UPDATE_NAMES).length};

    })();

    //
    // Grab all the version records for these updates
    //
    (function(){
        var sw = new StopWatch();
        var flaggedCount = 0;
        var versionCount = 0;

        var gr = new GlideRecord("sys_update_version");
        gr.setWorkflow(false);
        gr.addQuery("name", "IN", Object.keys(UPDATE_NAMES).join());
        gr.orderByDesc("sys_created_on", true);
        gr.query();

        while(gr.next()){
            var name = gr.getValue("name"),
                state = gr.state.toString(),
                payload = gr.getValue("payload"),
                sourceTable = gr.source_table.toString();

            if(sourceTable == "sys_upgrade_history") {
                UPDATE_NAMES[name].customerCreatedFile = false;
                flaggedCount++;
            }

            if(state == "current")
                continue;

            if(!payload)
                continue;

            var createdOn = new GlideDateTime(gr.getValue("sys_created_on"));
            var createdInRange = (createdOn.getNumericValue() >= DATE_RANGE.startDate.getNumericValue() && createdOn.getNumericValue() <= DATE_RANGE.endDate.getNumericValue());
 
            if (createdInRange) {
                if (VERSION_RECORDS[name] === undefined)
                    VERSION_RECORDS[name] = [];

                VERSION_RECORDS[name].push(payload);
                versionCount++;
            } else {
                //
                // If the record is not in the date range, we at least want to store the last version so we have something to compare against
                //
                if (VERSION_RECORDS[name] === undefined || VERSION_RECORDS[name].length === 0) {
                    VERSION_RECORDS[name] = [];
                    VERSION_RECORDS[name].push(payload);
                    versionCount++;
                }
            }
        }

        RESULTS.log["GetVersionRecords"] = { queryTime: sw.getTime(), flaggedCount: flaggedCount, versions: { files: Object.keys(VERSION_RECORDS).length, count: versionCount } };

    })();

    //
    // Now get the update payload for each of these records, check the script fields and count the lines of code
    //
    (function(){
        var sw = new StopWatch();
        var updatedRecords = {};
        var maintPattern = Packages.java.util.regex.Pattern.compile("^(.*)@snc(?:\\.(.*))?$");

        var isMaintUser = function(userName) {
            var matcher = maintPattern.matcher(userName);
            return matcher.find();
        };

        var parsePayload = function(payload, pattern) {
            var matcher = pattern.matcher(payload);

            if(matcher.find()) {
                var value = "" + matcher.group(2);
                var sanitizedValue = value.replace(/\s+/g, "");
                var linesOfCode = (value.match(/\r\n|\r|\n/g) || "").length + 1;

                return { sanitizedValue: sanitizedValue, linesOfCode: linesOfCode };
            }
        };

        var gr = new GlideRecord("sys_update_xml");
        gr.setWorkflow(false);
        gr.addQuery("name", "IN", Object.keys(UPDATE_NAMES).join());
        gr.addNullQuery("remote_update_set");
        gr.orderByDesc("sys_recorded_at", true);
        gr.addQuery("sys_created_on", ">=", DATE_RANGE.startDate);
        gr.addQuery("sys_created_on", "<=", DATE_RANGE.endDate);
        gr.query();

        RESULTS.log["ProcessPayloads"] = { queryTime: sw.getTime(), processingTime: 0 };
        sw = new StopWatch();

        while(gr.next()) {
            var name = gr.getValue("name"),
                createdBy = "" + gr.getValue("sys_created_by"),
                updateName = UPDATE_NAMES[name],
                tableName = updateName.tableName,
                tableFields = updateName.tableFields,
                fileCreatedOn = new GlideDateTime(updateName.createdOn),
                payload = gr.getValue("payload"),
                replaceOnUpgrade = "" + gr.getValue("replace_on_upgrade"),
                action = "" + gr.getValue("action");

            if(updatedRecords[name] !== undefined)
                continue;

            updatedRecords[name] = true;

            if (replaceOnUpgrade === "1" || action === "DELETE")
                continue;

            if(!payload)
                continue;

            if(createdBy == "system" || createdBy == "guest" || isMaintUser(createdBy)) {
                RESULTS.ommittedRecords.maint++;
                continue;
            }

            for(var i = 0; i < tableFields.length; i++){
                var field = tableFields[i];
                var pattern = Packages.java.util.regex.Pattern.compile(
                    "<" +
                    field.name +
                    ">(<\\!\\[CDATA\\[)?([\\s\\S]*?)(\\]\\]>)?<\\/" +
                    field.name +
                    ">"
                );
                var currentScriptVersion = parsePayload(payload, pattern);

                if(currentScriptVersion !== undefined && currentScriptVersion.sanitizedValue !== field.defaultValue) {

                    if(currentScriptVersion.sanitizedValue.indexOf("glide.security.allow_unauth_roleless_acl") != -1) {
                        RESULTS.ommittedRecords.acl++;
                        continue;
                    }

                    if(field.name == "client_script_v2" && currentScriptVersion.sanitizedValue == "functiononClick(g_form){}"){
                        RESULTS.ommittedRecords.clientScriptV2++;
                        continue;
                    }

                    var fileCreatedInSameDateRange = (fileCreatedOn.getNumericValue() >= DATE_RANGE.startDate.getNumericValue() && fileCreatedOn.getNumericValue() <= DATE_RANGE.endDate.getNumericValue());
                    var scriptFieldChanged = false;
                    var linesOfCode = 0;

                    //
                    // Loop through version records and check if the field value has changed
                    //
                    if(VERSION_RECORDS[name] !== undefined) {
                        var currentVersion = currentScriptVersion;

                        for(var j = 0; j < VERSION_RECORDS[name].length; j++){
                            var previousScriptVersion = parsePayload(VERSION_RECORDS[name][j], pattern);

                            if(previousScriptVersion !== undefined && previousScriptVersion.sanitizedValue !== currentVersion.sanitizedValue){
                                scriptFieldChanged = true;
                                linesOfCode += Math.abs(currentVersion.linesOfCode - previousScriptVersion.linesOfCode);
                                currentVersion = previousScriptVersion;
                            }
                        }
                    } else {
                        scriptFieldChanged = true;
                        linesOfCode = currentScriptVersion.linesOfCode;
                    }

                    if(RESULTS.summary === undefined){
                        RESULTS.summary = {
                            // ootbFileModification
                            o: 0,
                            // customerFileModification
                            c: 0,
                            // customerCreatedFileInSameRange
                            cc: 0,
                            // linesOfCode
                            l: 0,
                            // notChanged
                            noop: 0
                        };
                    }

                    if(RESULTS.tables[tableName] === undefined){
                        RESULTS.tables[tableName] = {
                            // fields
                            f: {},
                            // ootbFileModification
                            o: 0,
                            // customerFileModification
                            c: 0,
                            // customerCreatedFileInSameRange
                            cc: 0,
                            // linesOfCode
                            l: 0,
                            // notChanged
                            noop: 0
                        };
                    }

                    if(RESULTS.tables[tableName].f[field.name] === undefined){
                        RESULTS.tables[tableName].f[field.name] = {
                            // ootbFileModification
                            o: 0,
                            // customerFileModification
                            c: 0,
                            // linesOfCode
                            l: 0,
                            // notChanged
                            noop: 0
                        };
                    }

                    if(scriptFieldChanged){
                        RESULTS.summary.l += linesOfCode;
                        RESULTS.tables[tableName].l += linesOfCode;
                        RESULTS.tables[tableName].f[field.name].l += linesOfCode;

                        if(updateName.customerCreatedFile) {
                            RESULTS.summary.c++;
                            RESULTS.summary.cc += (fileCreatedInSameDateRange ? 1 : 0);
                            RESULTS.tables[tableName].c++;
                            RESULTS.tables[tableName].cc += (fileCreatedInSameDateRange ? 1 : 0);
                            RESULTS.tables[tableName].f[field.name].c++;
                        } 
                        else {
                            RESULTS.summary.o++;
                            RESULTS.tables[tableName].o++;
                            RESULTS.tables[tableName].f[field.name].o++;
                        }
                    } else {
                        RESULTS.summary.noop++;
                        RESULTS.tables[tableName].noop++;
                        RESULTS.tables[tableName].f[field.name].noop++;
                    }
                }
            }
        }

        RESULTS.log["ProcessPayloads"].processingTime = sw.getTime();

    })();

    gs.print(JSON.stringify(RESULTS));

})();