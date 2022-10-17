
var getCompanyCode = function() {
	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return null;

	return companyCode;
};
var getStringLength = function(text) {
    var length = 0;

    if(text != undefined && text != null){
        length = text.toString().length;
    }

    return length;
};

var getCustomBusinessRules = function(){
    var gr = new GlideRecord("sys_script");
    gr.setWorkflow(false);
    gr.addEncodedQuery("sys_scope.scopeSTARTSWITHx_" + getCompanyCode());
    gr.query();

    var results = [];

    while(gr.next()){

        results.push({ 
            scope: gr.sys_scope.scope.toString(),
            createdOn: gr.getValue("sys_created_on"),
            name: gr.getValue("name"),
            tableName: gr.getValue("collection"),
            advanced: (gr.getValue("advanced") == "1"),
            scriptConditionLength: getStringLength(gr.getValue("condition")),
            scriptLength: getStringLength(gr.getValue("script")),
            whenToRun: {
                when: gr.getValue("when"),
                filterConditions: gr.getValue("filter_condition"),
                roleConditions: gr.getValue("role_conditions"),
                triggers: {
                    onDelete: (gr.getValue("action_delete") == "1"),
                    onInsert: (gr.getValue("action_insert") == "1"),
                    onQuery: (gr.getValue("action_query") == "1"),
                    onUpdate: (gr.getValue("action_update") == "1"),
                }
            },
            actions: {
                setFieldValues: gr.getValue("template"),
                addMessage: (gr.getValue("add_message") == "1"),
                abortAction: (gr.getValue("abort_action") == "1"),
            }
        });
    }

    return results;
};


(function(){

	if(getCompanyCode() == null)
		return {};

	var auditResults = {
		customBusinessRules: getCustomBusinessRules()
	};

	gs.print(JSON.stringify(auditResults));

})();