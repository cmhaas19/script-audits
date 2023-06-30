
var EXCLUDED_TEMPLATES = { 
    "be3b52dcbd002010f8775d9559d0da01": true,
    "dab9529cbd002010f8775d9559d0dab6": true
};

var getPluginDetails = function() {
    var gr = new GlideRecord('sys_plugins');
    gr.setWorkflow(false);
    gr.addEncodedQuery("source=com.glideapp.servicecatalog.catalog_builder^active=true");
    gr.query();

    var plugin = { active: false, installed: "" };

    if (gr.next()) {
        plugin.active = true;
        plugin.installed = gr.getValue("install_date");
    }

    return plugin;
};

var getTemplateCounts = function() {
    var gr = new GlideAggregate("sc_template");

    if(!gr.isValid())
        return false;

    gr.setWorkflow(false);
    gr.addEncodedQuery("sys_id!=be3b52dcbd002010f8775d9559d0da01^sys_id!=dab9529cbd002010f8775d9559d0dab6");
    gr.addAggregate("COUNT");
    gr.groupBy("cat_item")
    gr.query();

    var templates = {};

    while(gr.next()) {
        var item = gr.cat_item.toString();

        templates[item] = {
            name: gr.cat_item.getDisplayValue(),
            count: parseInt(gr.getAggregate("COUNT"))
        };
    }

    return templates;

};

var getTemplateDetails = function() {
    var gr = new GlideRecord("sc_template_detail");

    if(!gr.isValid())
        return false;
        
    gr.setWorkflow(false);
    gr.addEncodedQuery("item_option_new!=NULL^readonly=true^template!=dab9529cbd002010f8775d9559d0dab6^ORtemplate=NULL^template!=be3b52dcbd002010f8775d9559d0da01^ORtemplate=NULL");
    gr.query();

    var readOnlyQuestions = {};

    while(gr.next()) {
        var question = gr.item_option_new.getDisplayValue();

        if(readOnlyQuestions[question] == undefined)
            readOnlyQuestions[question] = 0;

        readOnlyQuestions[question] += 1;
    }

    return readOnlyQuestions;
};

var getItemCounts = function() {
    var gr = new GlideAggregate('sc_cat_item');
    gr.setWorkflow(false);
    gr.addEncodedQuery("active=true^sys_class_name=sc_cat_item^ORsys_class_name=sc_cat_item_producer"); 
    gr.addAggregate('COUNT');
    gr.addTrend ('sys_created_on','Month');  
    gr.groupBy("sc_template");
    gr.groupBy("sys_class_name");
    gr.query();

    var results = {};

    while(gr.next()) {
        var hasTemplate = !gr.sc_template.nil(),
            month = gr.getValue('timeref'),
            className = gr.sys_class_name.toString(),
            count = parseInt(gr.getAggregate("COUNT"));

        if(hasTemplate && EXCLUDED_TEMPLATES[gr.sc_template.toString()] != undefined)
            continue;

        if(className == "sc_cat_item_producer")
            className = "rp";
        else 
            className = "item";

        if(results[month] == undefined)
            results[month] = {};

        if(results[month][className] == undefined)
            results[month][className] = { yes: 0, no: 0 };

        if(hasTemplate)
            results[month][className].yes += count;
        else
            results[month][className].no += count;
    }

    return results;
};


var output = {
	plugin: getPluginDetails(),
    templateCounts: getTemplateCounts(),
    itemCounts: getItemCounts(),
    templateDetails: getTemplateDetails()
};


gs.print(JSON.stringify(output));