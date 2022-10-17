

var dictionaryInfo = function(table) {
	var dictionaryEntries = {};

	var gr = new GlideRecord("sys_dictionary");
	gr.setWorkflow(false);
	gr.addEncodedQuery("nameINtask," + table);
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
};

var getFormFieldInfo = function(recordTypes, formViewQuery) {
	
	var forms = {};

	recordTypes.forEach(function(form){

		var dictionary = dictionaryInfo(form);

		var currentForm = {
			fieldTypes: {},
			formatters: {},
			otherTypes: {}
		};

		var gr = new GlideRecord("sys_ui_element");
		gr.setWorkflow(false);
		gr.addEncodedQuery("sys_ui_section.nameINtask," + form + "^" + formViewQuery + "^type!=.begin_split^ORtype=NULL^type!=.split^ORtype=NULL^type!=.end_split^ORtype=NULL");
		gr.query();

		while(gr.next()) {
			var element = gr.getValue("element"),
				elementType = gr.getValue("type");

			if(elementType == "formatter") {
				var formatterName = gr.sys_ui_formatter.name;

				if(formatterName && formatterName.toString().length && currentForm.formatters[formatterName] == undefined)
					currentForm.formatters[formatterName] = true;

			} else if(elementType != null) {
				if(currentForm.otherTypes[elementType] == undefined)
					currentForm.otherTypes[elementType] = [];

				currentForm.otherTypes[elementType].push(element);

			} else {
				var dictionaryItem = dictionary.findElementByName(element);

				if(dictionaryItem && currentForm.fieldTypes[dictionaryItem.glideType] == undefined)
					currentForm.fieldTypes[dictionaryItem.glideType] = true;
			}
		}

		forms[form] = currentForm;

	});

	return forms;
};

var coreRecordTypes = { 
	itsm: ["task","incident","problem","change_request","sc_request","sc_req_item","task_sla","incident_task","sc_task","change_task","sysapproval_approver"], 
	csm: ["sn_customerservice_case", "customer_account","customer_contact","csm_consumer","ast_contract","service_entitlement","csm_order","csm_order_line_item"]
};

var results = {
	csmActive: pm.isRegistered("com.sn_customerservice"),
	eventManagementActive: pm.isRegistered("com.glideapp.itom.snac"),
	formFields: {}
};

results.formFields.itsm = getFormFieldInfo(coreRecordTypes.itsm, "sys_ui_section.view=Default view");

if(results.csmActive)
	results.formFields.csm = getFormFieldInfo(coreRecordTypes.csm, "sys_ui_section.view.name=Case");


gs.print(JSON.stringify(results));



