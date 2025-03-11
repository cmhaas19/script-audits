
(function(){

    var DATE_RANGE = { startDate: new GlideDateTime("2020-01-01 00:00:00"), endDate: new GlideDateTime("2024-12-31 23:59:59")};
    var TABLES = ['sys_hub_flow','sys_pd_process_definition','sc_cat_item','sc_cat_item_producer','sys_app_template_spoke_configuration','sys_ux_app_config'];
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
    /*
    var wlm = GlideWhiteListManager.get();
    if (!wlm.isVisibleMember("java.util.regex.Matcher", "find", "()Z")) {
        wlm.addToMemberWhitelist("java.util.regex.Matcher", "find", "()Z");
    }
    */

    //
    // Initialize date ranges
    //
    DATE_RANGE.startDate = new GlideDateTime();
    DATE_RANGE.startDate.addMonthsUTC(-12);
    DATE_RANGE.startDate.setValue(DATE_RANGE.startDate.getDate() + " 00:00:00");

    DATE_RANGE.endDate = new GlideDateTime();
    DATE_RANGE.endDate.setValue(DATE_RANGE.endDate.getDate() + " 23:59:59");
    
    RESULTS.log["DateRanges"] = { s: DATE_RANGE.startDate.getValue(), e: DATE_RANGE.endDate.getValue()};

    //
    // Get the update names of all the records in these tables that have been updated within the given date range
    //
    (function(){
        var sw = new StopWatch();
        var gr = new GlideRecord("sys_metadata");
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_class_nameIN" + TABLES.join(","));
        
        var join = gr.addJoinQuery("sys_update_xml", "sys_update_name", "name");
        join.addCondition("sys_created_on", ">=", DATE_RANGE.startDate);
        join.addCondition("sys_created_on", "<=", DATE_RANGE.endDate);
        gr.query();

        while(gr.next()){
            var tableName = gr.getValue("sys_class_name"),
                updateName = gr.getValue("sys_update_name");

            UPDATE_NAMES[updateName] = { 
                tableName: tableName,
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

        RESULTS.summary = {
            // ootbFileModification
            o: 0,
            // customerFileModification
            c: 0,
            // customerCreatedFileInSameRange
            cc: 0,
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
                fileCreatedOn = new GlideDateTime(updateName.createdOn),
                fileCreatedInSameDateRange = (fileCreatedOn.getNumericValue() >= DATE_RANGE.startDate.getNumericValue() && fileCreatedOn.getNumericValue() <= DATE_RANGE.endDate.getNumericValue()),
                payload = gr.getValue("payload"),
                replaceOnUpgrade = "" + gr.getValue("replace_on_upgrade"),
                action = "" + gr.getValue("action"),
                createdBy = "" + gr.getValue("sys_created_by");

            if(updatedRecords[name] !== undefined)
                continue;

            updatedRecords[name] = true;

            if (replaceOnUpgrade === "1" || action === "DELETE")
                continue;

            if(!payload)
                continue;

            if(RESULTS.tables[tableName] === undefined){
                RESULTS.tables[tableName] = {
                    // ootbFileModification
                    o: 0,
                    // customerFileModification
                    c: 0,
                    // customerCreatedFileInSameRange
                    cc: 0,
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
        }

        RESULTS.log["ProcessPayloads"].processingTime = sw.getTime();

    })();

    gs.print(JSON.stringify(RESULTS));

})();