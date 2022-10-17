(function() {
    var api = new sn_appscopecmdb.AppScopeCMDBIntegrationAPI();
    var registryTable = "sn_appscopecmdb_scope_registry";
    var encodedQuery = "scopeSTARTSWITHx_aesc^instance_name=glide_db_dump";

    var deletableScope = new GlideRecord(registryTable);
    deletableScope.addEncodedQuery(encodedQuery);
    deletableScope.query();

    var startingCount = parseInt(deletableScope.getRowCount(), 10);
    gs.info("There are {0} candidate scopes to attempt to release", startingCount);

    while (deletableScope.next()) {
        var scopeName = deletableScope.getValue("scope");
        
        var ret = null;

        try {
            gs.info("Attempting to release {0}", scopeName);
            ret = api.releaseScopeByScopeName(scopeName);
        } catch(e) {
            gs.info("Unable to release scope {0}, error {1}", scopeName, e);
            continue;
        }
        if (typeof ret != "null") {
            if (ret.hasOwnProperty("isValid") && ret.isValid == "true") {
                gs.info("Released scope {0}", scopeName);
            }
        } else {
            gs.info("Unable to release scope {0}, it has a valid app apckage in this repo", scopeName);
        }
    }

    deletableScope.initialize();
    deletableScope.addQuery(encodedQuery);
    deletableScope.query();

    var endingCount = parseInt(deletableScope.getRowCount(), 10);
    gs.info("There are {0} scopes that still match the pattern, a difference of {1} (negative numbers indicate that many scopes were removed) (positive numbers mean math has gone crazy or someone registered new scopes while this script was running)", endingCount, (endingCount - startingCount));
})()