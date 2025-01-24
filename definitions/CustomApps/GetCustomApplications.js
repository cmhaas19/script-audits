
function getCustomApplications() {
    var companyCode = gs.getProperty('glide.appcreator.company.code');

    if (GlideStringUtil.nil(companyCode))
        return 0;

    var vendorPrefix = 'x_' + companyCode + '_';
    var query = "";

    // Get all custom apps's built by the customer (the scope should match the vendor code or be global)
    query += "sys_class_name=sys_app^scopeSTARTSWITH" + vendorPrefix + "^ORscope=global";

    // Ensure we also look at Store Apps that are built by the customer (where the scope matches the vendor code)
    query += "^NQsys_class_name=sys_store_app^scopeSTARTSWITH" + vendorPrefix;

    // And let's not forgot global apps built by the customer (but ensure we exclude ServiceNow apps)
    query += "^NQsys_class_name=sys_store_app^scope=global^vendorISEMPTY^ORvendor!=ServiceNow";

    var gr = new GlideAggregate('sys_scope');
    gr.addAggregate('COUNT');
    gr.addEncodedQuery(query);
    gr.query();

    return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

};

answer = getCustomApplications();