

var getCatalogActionDetails = function() {
    var actionValues = {};

    //
    // Get Service Catalog triggered flows
    //
    var flows = (function(){
        var gr = new GlideRecord("sys_hub_trigger_instance");
		gr.setWorkflow(false);
		gr.addEncodedQuery("trigger_type=service_catalog");
		gr.query();

        var flows = {};

        while(gr.next()) {
            flows[gr.flow.toString()] = true;
        }

        return Object.keys(flows);

    })();

    //
    // Get the Update Record and Wait For Condition actions from these flows
    //
    var actions = (function(){
        var gr = new GlideRecord("sys_hub_action_instance");
		gr.setWorkflow(false);
		gr.addEncodedQuery("action_type_parent=baf174c8c3c232002841b63b12d3aee4^ORaction_type_parent=8bb9a8160b10030085c083eb37673aec^flowIN" + flows.join(","));
		gr.query();

        var actions = {};

        while(gr.next()) {
            var id = gr.getUniqueValue();
            var actionName = gr.action_type_parent.getDisplayValue();

            if(actions[actionName] == undefined)
                actions[actionName] = {};

            actions[actionName][id] = true;
        }

        return actions;

    })();

    //
    // Now get the details for these
    //
    (function(){
        for(var actionName in actions) {
            var actionIds = Object.keys(actions[actionName]).join(",");

            var gr = new GlideRecord("sys_variable_value");
            gr.setWorkflow(false);
            gr.addEncodedQuery("document=sys_hub_action_instance^document_keyIN" + actionIds + "^variableSTARTSWITHTable^ORvariableSTARTSWITHFields^ORvariableSTARTSWITHConditions");
            gr.query();

            if(actionValues[actionName] == undefined)
                actionValues[actionName] = {};

            while(gr.next()) {
                var key = gr.variable.getDisplayValue();
                var originalValue = gr.getValue("value");
                var value = "";

                if(actionValues[actionName][key] == undefined) {
                    actionValues[actionName][key] = {};
                }

                if(key == "Fields" || key == "Conditions") {
                    value = parseFields(originalValue);
                } else {
                    value = originalValue;
                }

                if(actionValues[actionName][key][value] == undefined) {
                    actionValues[actionName][key][value] = 0;
                }

                actionValues[actionName][key][value]++;
            }
        }
    })();

    return actionValues;
};

var parseFields = function(fields) {
    var parsedFields = {};

    if(fields != undefined && fields != null) {
        var s = fields.split("^");

        for(var i = 0;i < s.length;i++) {
            var values = s[i].split("=");

            if(values.length > 0)
                parsedFields[values[0]] = true;
        }
    }

    return Object.keys(parsedFields).sort().join(",");
};

var setSessionLanguage = function() {
    try {
        gs.getSession().setLanguage("en");
    } catch(e) { }
};


(function(){
    
    setSessionLanguage();

	var auditResults = {
		actions: getCatalogActionDetails()
	};

	gs.print(JSON.stringify(auditResults));

})();