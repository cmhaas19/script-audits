
var getTemplates = function(query) {
    var data = {};

    var gr = new GlideAggregate("sys_app_template_instance");

    if(!gr.isValid())
        return data;

    gr.setWorkflow(false);
    gr.addEncodedQuery(query);
    gr.groupBy("template");
    gr.addTrend("sys_created_on", 'Month');
    gr.addAggregate("COUNT");
    gr.setGroup(false);
    gr.query();

    while(gr.next()){
        var templateId = gr.template.toString();

        if(data[templateId] == undefined)
            data[templateId] = { templateName: gr.template.getDisplayValue(), months: {} };

        data[templateId].months[gr.getValue("timeref")] = parseInt(gr.getAggregate("COUNT"));
    }

    return data;
}

var getObjectTemplateUsage = function() {
    return getTemplates("app_template=false^state=complete");
};

var getAppTemplateUsage = function() {
    return getTemplates("app_template=true^state=complete");
};

var getCurrentLanguage = function() {
	var language = "N/A";
	try {
		language = gs.getSession().getLanguage();
	} catch(e) {}

	return language;
};

(function(){

    var results = {
        currentLanguage: getCurrentLanguage(),
        appTemplates: getAppTemplateUsage(),
        objectTemplates: getObjectTemplateUsage()
    };

    gs.print(JSON.stringify(results));

})();