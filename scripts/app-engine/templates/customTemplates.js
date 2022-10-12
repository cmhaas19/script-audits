
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getCustomAppTemplates = function() {
    var templates = {};

    //
    // Get the custom template SysId's
    //
    (function(){
        var gr = new GlideRecord("sys_app_template");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.setLimit(70);
        gr.addEncodedQuery("create_app=1^sys_scope.scopeSTARTSWITHx_" + getCompanyCode());
        gr.query();

        while(gr.next()) {
            templates[gr.getUniqueValue()] = {
                name: gr.getValue("name"),
                active: (gr.getValue("active") == "1"),
                scope: gr.sys_scope.scope.toString(),
                type: gr.getValue("type"),
                createdOn: new GlideDateTime(gr.getValue("sys_created_on")).getDate().getValue(),
                scanInstance: "",
                contents: {}
            };
        }

    })();

    //
    // Get the associated Scan IDs
    //
    (function(){
        var gr = new GlideRecord("sys_app_template_input_var");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.addEncodedQuery("name=scan_id^templateIN" + Object.keys(templates).join(","));
        gr.query();

        while(gr.next()) {
            var templateId = gr.getValue("template");
            var scanInstance = gr.getValue("default");

            templates[templateId].scanInstance = scanInstance;
        }

    })();


    //
    // Payloads
    //
    (function(){
        var scanInstances = [];

        for(var id in templates) {
            scanInstances.push(templates[id].scanInstance);
        }

        var gr = new GlideAggregate("sys_app_scan_payload");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.addEncodedQuery("scan_instanceIN" + scanInstances.join(","));
        gr.addAggregate("COUNT");
        gr.groupBy("scan_instance");
        gr.groupBy("source_class");
        gr.query();

        while(gr.next()) {
            var scanInstance = gr.scan_instance.toString();
            var className = gr.source_class.toString();

            for(var id in templates) {
                if(templates[id].scanInstance == scanInstance) {
                    templates[id].contents[className] = parseInt(gr.getAggregate("COUNT"));
                }
            }
        }

    })();

    //
    // Trim-down the payload by removing unnecessary fields
    //
    for(var id in templates) {
        delete templates[id].scanInstance;
    }

    return templates;
};

(function(){

    var results = {
        templates: getCustomAppTemplates()
    };

    gs.print(JSON.stringify(results));

})();