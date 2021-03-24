

var forms = ["task","incident","problem","change_request","sc_request","sc_req_item","task_sla","incident_task","sc_task","change_task","sysapproval_approver"];

var dictionary = (function() {
	var dictionaryEntries = {};

	var gr = new GlideRecord("sys_dictionary");
	gr.setWorkflow(false);
	gr.addEncodedQuery("nameIN" + forms.join(","));
	gr.query();

	while(gr.next()) {
		var element = gr.getValue("element");

		dictionaryEntries[element] = {
			"name": gr.getValue("name"),
			"element": element,
			"glideType": gr.getValue("internal_type"),
			"reference": gr.getValue("reference")
		};
	}
	
	return {
		findElementByName: function(elementName) {
			return dictionaryEntries[elementName];
		}
	};

})();

var results = {};

forms.forEach(function(form) {

	var currentForm = {
		name: form,
		fieldTypes: {},
		formatters: {}
	};

	var gr = new GlideRecord("sys_ui_element");
	gr.setWorkflow(false);
	gr.addEncodedQuery("sys_ui_section.nameINtask," + form + "^sys_ui_section.view=Default view^type!=.begin_split^ORtype=NULL^type!=.split^ORtype=NULL^type!=.end_split^ORtype=NULL");
	gr.query();

	while(gr.next()) {
		var element = gr.getValue("element"),
			elementType = gr.getValue("type");

		if(elementType == "formatter") {
			var formatterName = gr.sys_ui_formatter.name;

			if(formatterName && formatterName.toString().length && currentForm.formatters[formatterName] == undefined)
				currentForm.formatters[formatterName] = true;

		} else {
			var dictionaryItem = dictionary.findElementByName(element);

			if(dictionaryItem && currentForm.fieldTypes[dictionaryItem.glideType] == undefined)
				currentForm.fieldTypes[dictionaryItem.glideType] = true;
		}
	}

	results[form] = currentForm;

});


gs.print(JSON.stringify(results));


