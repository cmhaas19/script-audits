
var getCompanyCode = function() {
	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return null;

	return companyCode;
};

var getFieldsOnForms = function() {
    var gr = new GlideAggregate("sys_ui_element");
	gr.setWorkflow(false);
    gr.groupBy("element");
	gr.addEncodedQuery("sys_ui_section.view=Default view^type!=.begin_split^ORtype=NULL^type!=.split^ORtype=NULL^type!=.end_split^ORtype=NULL^type!=formatter^ORtype=NULL");
    gr.addAggregate("COUNT");

    var tables = gr.addJoinQuery("sys_db_object", "sys_ui_section.name", "name");
    tables.addCondition("super_class.name", "=", "task");
    tables.addCondition("sys_scope.scope", "STARTSWITH", "x_" + getCompanyCode());

    gr.query();

    var elements = {};
    
    while(gr.next()) {
        var element = gr.getValue("element"),
			elementCount = parseInt(gr.getAggregate("COUNT"));

        elements[element] = elementCount;
    }

    return elements;

};

(function(){
    var elements = getFieldsOnForms();
    gs.print(JSON.stringify(elements));

})();


