
var getCompanyCode = function() {
	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return null;

	return companyCode;
}

var TRIGGER_TYPES = {
	"798916a0c31322002841b63b12d3ae7c": { name: "Created", value: 1 },
	"a45d9180c32222002841b63b12d3aea7": { name: "Created or Updated", value: 2 },
	"89142dc0c32222002841b63b12d3ae8a": { name: "Daily", value: 3 },
	"6f0180400b320300f4eb8bf637673ad4": { name: "Inbound Email", value: 4 },
	"2ca52504c32222002841b63b12d3ae4a": { name: "Monthly", value: 5 },
	"f63f0d94c32222002841b63b12d3aeed": { name: "Repeat", value: 6 },
	"0a76e504c32222002841b63b12d3aeac": { name: "Run Once", value: 7 },
	"c43a1011c36813002841b63b12d3ae15": { name: "Service Catalog", value: 8 },
	"f5ce00a873723300d70877186bf6a759": { name: "SLA Task", value: 9 },
	"36442d80c32222002841b63b12d3aec5": { name: "Trigger Rest", value: 10 },
	"bb695e60c31322002841b63b12d3aea5": { name: "Updated", value: 11 },
	"cf352104c32222002841b63b12d3ae1f": { name: "Weekly", value: 12 }
};

var getFlows = function() {

	//
	// Cache all table variables
	//
	var tableVariables = (function(){
		var gr = new GlideRecord("sys_variable_value");
		gr.setWorkflow(false);
		gr.addEncodedQuery("document=sys_hub_trigger_instance^variable.internal_type=table_name");
		gr.query();

		var data = {};

		while(gr.next()) {
			var id = gr.getValue("document_key");
			data[id] = gr.getValue("value");
		}

		return data;

	})();

	//
	// Get associated table info (name, scope)
	//
	var tableDetails = (function(){
		var tableNames = {};
		var data = {};

		for(var id in tableVariables){
			tableNames[tableVariables[id]] = true;
		}

		var gr = new GlideRecord("sys_db_object");
		gr.setWorkflow(false);
		gr.addEncodedQuery("nameIN" + Object.keys(tableNames).join(","));
		gr.query();

		while(gr.next()){
			data[gr.getValue("name")] = {
				name: gr.getValue("name"),
				scope: gr.sys_scope.scope.toString()
			}
		}

		return data;

	})();

	//
	// Retrieve flow data
	// 
	var flows = (function(){
		var gr = new GlideRecord("sys_hub_flow");
		gr.setWorkflow(false);
		gr.addQuery('sys_scope.scope', 'NOT LIKE', 'sn_%');
		gr.addQuery("type", "flow");
		gr.orderBy("sys_scope");
		gr.setLimit(225);
		gr.query();

		var data = {};

		while(gr.next()){
			data[gr.getUniqueValue()] = {
				//name: gr.getValue("name"),
				active: (gr.getValue("active") == "1"),
				scope: gr.sys_scope.scope.toString()
			};
		}

		return data;

	})();

	//
	// Get flow triggers
	//
	(function(){
		var gr = new GlideRecord("sys_hub_trigger_instance");
		gr.setWorkflow(false);
		gr.addEncodedQuery("flowIN" + Object.keys(flows).join(","));
		gr.query();

		while(gr.next()){
			var flowId = gr.getValue("flow");
			var flow = flows[flowId];
			var tableName = tableVariables[gr.getUniqueValue()];
			var definitionId = gr.getValue("trigger_definition");
			var type = gr.getValue("trigger_type");

			if(TRIGGER_TYPES[definitionId]) {
				type = TRIGGER_TYPES[definitionId].value;
			}

			var trigger = {
				type: type
			};

			if(tableName) {
				trigger.table = tableDetails[tableName];
			}

			flow.trigger = trigger;
		}
	})();

	//
	// Convert to array so the payload is smaller
	//
	var flowArray = [];

	for(var id in flows) {
		flowArray.push(flows[id]);
	}

	return flowArray;
};


(function(){

	if(getCompanyCode() == null)
		return {};

	var auditResults = {
		companyCode: getCompanyCode(),
		flows: getFlows()
	};

	gs.print(JSON.stringify(auditResults));

})();