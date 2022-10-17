
var ENCODED_QUERY = "sys_package.name!=Instance Troubleshooter^sys_package.name!=Instance Security Center^sys_package.name!=Example Instance Checks^sys_package.name!=Instance Scan";


var getInstallationStatus = function() {
    var api = new GlideScopeAPI();

    return {
        "sn_troubleshooter": api.scopeExistsInInstance("sn_troubleshooter"),
        "sn_isc_core": api.scopeExistsInInstance("sn_isc_core"),
        "x_appe_exa_checks": api.scopeExistsInInstance("x_appe_exa_checks")
    };
};

var getInstanceScanCheckAggregates = function() {
    var results = {};

    (function(r){
        var gr = new GlideAggregate("scan_check");
        gr.setWorkflow(false);
        gr.addEncodedQuery(ENCODED_QUERY);
        gr.groupBy("sys_class_name");
        gr.addAggregate("COUNT");
        gr.query();

        r.checksByType = {};

        while(gr.next()) {
            var className = gr.sys_class_name.toString(),
                count = parseInt(gr.getAggregate("COUNT"));

            r.checksByType[className] = count;            
        }

    })(results);

    (function(r){
        var gr = new GlideAggregate("scan_check");
        gr.setWorkflow(false);
        gr.addEncodedQuery(ENCODED_QUERY);
        gr.groupBy("category");
        gr.addAggregate("COUNT");
        gr.query();

        r.checksByCategory = {};

        while(gr.next()) {
            var category = gr.category.toString(),
                count = parseInt(gr.getAggregate("COUNT"));

            r.checksByCategory[category] = count;            
        }

    })(results);

    (function(r){
        var gr = new GlideAggregate("scan_target");
        gr.setWorkflow(false);
        gr.addEncodedQuery("table=sys_scope");
        gr.addAggregate("COUNT");
        gr.query();

        r.scopeScanCount = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

    })(results);

    return results;    
};

var getInstanceScanCheckDetails = function() {
    var gr = new GlideRecord("scan_check");
    gr.setWorkflow(false);
    gr.setLimit(200);
    gr.addEncodedQuery(ENCODED_QUERY);
    gr.query();

    var details = [];

    while(gr.next()) {
        details.push({
            nm: gr.getValue("name"),
            cat: gr.getValue("category"),
            classNm: gr.getValue("sys_class_name"),
            pkg: gr.sys_package.getDisplayValue(),
        });
    }

    return details;
};


(function(){

	var auditResults = {
        installationStatus: getInstallationStatus(),
        aggregates: getInstanceScanCheckAggregates(),
        details: getInstanceScanCheckDetails()
	};

	gs.print(JSON.stringify(auditResults));

})();