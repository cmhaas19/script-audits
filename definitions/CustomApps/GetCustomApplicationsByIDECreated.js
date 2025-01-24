function getCustomApplicationsByIDE() {
    var companyCode = gs.getProperty('glide.appcreator.company.code');
	var apps = {};

    if (GlideStringUtil.nil(companyCode))
        return apps;

    var vendorPrefix = 'x_' + companyCode + '_';
    var query = "";

    // Get all custom apps's built by the customer (the scope should match the vendor code or be global)
    query += "sys_class_name=sys_app^scopeSTARTSWITH" + vendorPrefix + "^ORscope=global";

    // Ensure we also look at Store Apps that are built by the customer (where the scope matches the vendor code)
    query += "^NQsys_class_name=sys_store_app^scopeSTARTSWITH" + vendorPrefix;

    // And let's not forgot global apps built by the customer (but ensure we exclude ServiceNow apps)
    query += "^NQsys_class_name=sys_store_app^scope=global^vendorISEMPTY^ORvendor!=ServiceNow";

    var gr = new GlideRecord('sys_scope');
    gr.addEncodedQuery(query);
    gr.query();

	while(gr.next()) {
		var ide = null;

		if(gr.isValidField("ide_created") && !gr.ide_created.nil()) {
			ide = gr.getValue("ide_created");
		}

		if((ide == null || ide == "") && gr.isValidField("package_json") && !gr.package_json.nil()) {
			ide = "IDE";
		}

		if(ide == null || ide == "") {
			ide = "Unknown";
		}

		if(apps[ide] == undefined)
			apps[ide] = 0;

		apps[ide]++;
	}

    return apps;

};

answer = getCustomApplicationsByIDE();