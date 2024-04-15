
(function(){

    var DATE_RANGE = { startDate: new GlideDateTime("2020-01-01 00:00:00"), endDate: new GlideDateTime("2024-12-31 23:59:59")};
    var TABLES_WITH_SCRIPT_FIELDS = {};
    var UPDATE_NAMES = {};
    var VERSION_RECORDS = {};
    var RESULTS = { log: {}, summary: {}, tables: {} };

    var StopWatch = function() {
        var start = new GlideDateTime();
    
        return {
            getTime: function() {
                var duration = GlideDateTime.subtract(start, new GlideDateTime());
                return duration.getNumericValue();
            }
        };
    };

    // Turn off excess logging for the Regex Matcher
    // NOTE: Be sure to remove this before submitting the script audit, the instance analyzer team considers these calls a write audit
    var wlm = GlideWhiteListManager.get();
    if (!wlm.isVisibleMember("java.util.regex.Matcher", "find", "()Z")) {
        wlm.addToMemberWhitelist("java.util.regex.Matcher", "find", "()Z");
    }

    //
    // Initialize date ranges
    //
    /*
    var today = new GlideDateTime();
    DATE_RANGE.startDate.setYearUTC((today.getYear() - 1));
    DATE_RANGE.endDate.setYearUTC((today.getYear() - 1));  
    */         
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

            //
            // We only care about 'previous' versions. 'Current' represents the sys_update_xml record we already have and 'History'
            // records can come after the current version (they are essentially 'Skip' records)
            //
            if(state != "previous")
                continue;

            if(!payload)
                continue;

            var createdOn = new GlideDateTime(gr.getValue("sys_created_on"));
            var createdInRange = (createdOn.getNumericValue() >= DATE_RANGE.startDate.getNumericValue() && createdOn.getNumericValue() <= DATE_RANGE.endDate.getNumericValue());
 
            //
            // Store this version record if it was created within the date range or if it's the first version record we've seen
            //
            if (createdInRange) {
                VERSION_RECORDS[name] = VERSION_RECORDS[name] || [];
                VERSION_RECORDS[name].push(payload);
                versionCount++;
            } else if (VERSION_RECORDS[name] === undefined) {
                VERSION_RECORDS[name] = [payload];
                versionCount++;
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

        RESULTS.summary = {
            // ootbFileModification
            o: 0,
            // customerFileModification
            c: 0,
            // customerCreatedFileInSameRange
            cc: 0,
            // linesOfCode
            l: 0,
            // unChanged
            unc: 0,
            // maint
            m: 0
        };

        var gr = new GlideRecord("sys_update_xml");
        gr.setWorkflow(false);
        gr.addQuery("name", "IN", Object.keys(UPDATE_NAMES).join());
        gr.addNullQuery("remote_update_set");
        gr.orderByDesc("sys_recorded_at");
        gr.addQuery("sys_created_on", ">=", DATE_RANGE.startDate);
        gr.addQuery("sys_created_on", "<=", DATE_RANGE.endDate);
        gr.query();

        RESULTS.log["ProcessPayloads"] = { queryTime: sw.getTime(), processingTime: 0 };
        sw = new StopWatch();

        while(gr.next()) {
            var name = gr.getValue("name"),
                updateName = UPDATE_NAMES[name],
                tableName = updateName.tableName,
                tableFields = updateName.tableFields,
                fileCreatedOn = new GlideDateTime(updateName.createdOn),
                fileCreatedInSameDateRange = (fileCreatedOn.getNumericValue() >= DATE_RANGE.startDate.getNumericValue() && fileCreatedOn.getNumericValue() <= DATE_RANGE.endDate.getNumericValue()),
                payload = gr.getValue("payload"),
                replaceOnUpgrade = "" + gr.getValue("replace_on_upgrade"),
                action = "" + gr.getValue("action"),
                createdBy = "" + gr.getValue("sys_created_by"),
                updateHasScriptChanges = false;

            if(updatedRecords[name] !== undefined)
                continue;

            updatedRecords[name] = true;

            if (replaceOnUpgrade === "1" || action === "DELETE")
                continue;

            if(!payload)
                continue;

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
                    // unChanged
                    unc: 0,
                    // maint
                    m: 0
                };
            }

            // If this change was done by ServiceNow, don't process it
            if(createdBy == "system" || createdBy == "guest" || isMaintUser(createdBy)){
                RESULTS.summary.m++;
                RESULTS.tables[tableName].m++;
                continue;
            }

            for(var i = 0; i < tableFields.length; i++){
                var field = tableFields[i];
                var pattern = Packages.java.util.regex.Pattern.compile("<" + field.name + ">(<\\!\\[CDATA\\[)?([\\s\\S]*?)(\\]\\]>)?<\\/" + field.name + ">");
                var currentScriptVersion = parsePayload(payload, pattern);

                if(currentScriptVersion !== undefined && currentScriptVersion.sanitizedValue !== field.defaultValue) {
                    var omitField = false;
                    var scriptFieldChanged = false;
                    var linesOfCodeChanged = 0;                    

                    if(RESULTS.tables[tableName].f[field.name] === undefined){
                        RESULTS.tables[tableName].f[field.name] = {
                            // ootbFileModification
                            o: 0,
                            // customerFileModification
                            c: 0,
                            // linesOfCode
                            l: 0,
                            // unChanged
                            unc: 0
                        };
                    }

                    // A write audit from ServiceNow generated a ton of ACL changes. Make sure we flag them
                    if(currentScriptVersion.sanitizedValue.indexOf("glide.security.allow_unauth_roleless_acl") != -1) {
                        omitField = true;
                    }

                    // This annoying field on UI Actions sets its default value via a UI policy or client script so it passes the default value check above. Make sure we flag it.
                    if(field.name == "client_script_v2" && currentScriptVersion.sanitizedValue == "functiononClick(g_form){}"){
                        omitField = true;
                    }

                    if(omitField){
                        RESULTS.tables[tableName].f[field.name].o++;
                        continue;
                    }

                    //
                    // Loop through version records and check if the field value has changed
                    //
                    if(VERSION_RECORDS[name] !== undefined && VERSION_RECORDS[name].length > 0) {
                        var currentVersion = currentScriptVersion;

                        for(var j = 0; j < VERSION_RECORDS[name].length; j++){
                            var previousScriptVersion = parsePayload(VERSION_RECORDS[name][j], pattern);

                            if(previousScriptVersion !== undefined && previousScriptVersion.sanitizedValue !== currentVersion.sanitizedValue){
                                
                                // Calculate the difference in lines of code
                                var linesChanged = Math.abs(currentVersion.linesOfCode - previousScriptVersion.linesOfCode);

                                // If the lines of code are the same, add at least 1 as something has changed to get this far
                                linesOfCodeChanged += (linesChanged > 0 ? linesChanged : 1);

                                // Make sure to mark this as changed
                                scriptFieldChanged = true;
                                
                                currentVersion = previousScriptVersion;                                
                            }
                        }
                    } else {
                        // If no version records exists, this is most likely the first version of the record
                        scriptFieldChanged = true;
                        linesOfCodeChanged = currentScriptVersion.linesOfCode;
                    }

                    // If we detect a script field change, flag it so we count the file as modified
                    updateHasScriptChanges = (updateHasScriptChanges || scriptFieldChanged);

                    if(scriptFieldChanged){

                        // Track the nuber of lines of code changed
                        RESULTS.summary.l += linesOfCodeChanged;
                        RESULTS.tables[tableName].l += linesOfCodeChanged;
                        RESULTS.tables[tableName].f[field.name].l = linesOfCodeChanged;

                        if(updateName.customerCreatedFile) {
                            // Track as a customer file modification
                            RESULTS.tables[tableName].f[field.name].c++;
                        } 
                        else {
                            // Track as an OOTB file modification
                            RESULTS.tables[tableName].f[field.name].o++;
                        }
                    } else {
                        // Since the script feilds didn't change, track as unchanged
                        RESULTS.tables[tableName].f[field.name].unc++;
                    }
                }
            } // end field loop

            if(updateHasScriptChanges) {
                if(updateName.customerCreatedFile) {
                    // Track as a customer file modification
                    RESULTS.summary.c++;
                    RESULTS.tables[tableName].c++;

                    // If the file was created within the date range, track as a customer created file
                    RESULTS.summary.cc += (fileCreatedInSameDateRange ? 1 : 0);
                    RESULTS.tables[tableName].cc += (fileCreatedInSameDateRange ? 1 : 0);
                } 
                else {
                    // Track as an OOTB file modification
                    RESULTS.summary.o++;
                    RESULTS.tables[tableName].o++;
                }

            } else {
                // Since the script feilds didn't change, track as unchanged
                RESULTS.summary.unc++;
                RESULTS.tables[tableName].unc++;
            }
        }

        RESULTS.log["ProcessPayloads"].processingTime = sw.getTime();

    })();

    gs.print(JSON.stringify(RESULTS));

})();