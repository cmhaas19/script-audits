

var getCustomApplications = function() {
	var prefix = 'x_';
	var prefixSeperator = '_';
    var companyCode = gs.getProperty('glide.appcreator.company.code');
    var vendorPrefix = prefix + companyCode + prefixSeperator;
    var result = {
        vendorPrefix: vendorPrefix,
        customAppsAll: 0,
        customAppsPrefixed: 0,
        storeApps: 0,
        vendorApps: 0,
        calculatedTotalApps: 0
    };

    //
    // Get count of Custom Applications
    //
    (function(){
        var gr = new GlideAggregate('sys_app');
        gr.setWorkflow(false);
        gr.addAggregate('COUNT');
        gr.query();

        result.customAppsAll = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

    })();

    //
    // Get count of Custom Applications
    //
    (function(){
        var gr = new GlideAggregate('sys_app');
        gr.setWorkflow(false);
        gr.addQuery('scope', 'STARTSWITH', vendorPrefix);
        gr.addAggregate('COUNT');
        gr.query();

        result.customAppsPrefixed = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

    })();

    //
    // Get count of Store Applications
    //
    (function(){
        if (!GlideStringUtil.nil(companyCode)) {
            var gr = new GlideAggregate('sys_store_app');
            gr.setWorkflow(false);
            gr.addQuery('scope', 'STARTSWITH', vendorPrefix);
            gr.addOrCondition('scope', '=', 'global');
            gr.addAggregate('COUNT');
            gr.query();
    
            result.storeApps = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
        }
    })();

    //
    // Get count of Vendor Applications
    //
    (function(){
        var gr = new GlideAggregate('sys_app');
        gr.setWorkflow(false);
        gr.addQuery('scope', 'STARTSWITH', prefix);
        gr.addQuery('scope', 'NOT MATCHES', vendorPrefix + '%');
        gr.addAggregate('COUNT');
        gr.query();

        result.vendorApps = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
    })();

    result.calculatedTotalApps = (result.storeApps + result.customAppsAll) - result.vendorApps;
	
    return result;
}

gs.print(JSON.stringify(getCustomApplications()));