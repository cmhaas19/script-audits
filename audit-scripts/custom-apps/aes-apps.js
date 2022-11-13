
var getTemplateGeneratedApps = function(range) {    
    var apps = {};
    var gr = new GlideRecord("sys_app_template_output_var_instance");

    if(!gr.isValid())
        return apps;

    gr.chooseWindow(range.start, range.end);
    gr.setWorkflow(false);
    gr.addEncodedQuery("name=app_sys_id^template_instance.app_template=true^template_instance.state=complete^valueNOT LIKEstep");
    gr.orderByDesc("sys_created_on");
    gr.query();

    while(gr.next()){
        var appId = gr.getValue("value"),
            createdOn = gr.getValue("sys_created_on");

        apps[appId] = new GlideDateTime(createdOn).getDate().getValue();
    }

    return {
        totalApps: gr.getRowCount(),
        apps: apps
    };
};

(function() {

    var ranges = {
        r1: { start: 0, end: 549 },
        r2: { start: 550, end: 1099 },
        r3: { start: 1100, end: 1649 },
        r4: { start: 1650, end: 2199 },
    };

    var apps = getTemplateGeneratedApps(ranges.r1);

    gs.print(JSON.stringify(apps));

})();