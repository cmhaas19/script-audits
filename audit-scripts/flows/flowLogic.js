
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

var TABLE_CACHE = {};

var setSessionLanguage = function() {
    try {
        gs.getSession().setLanguage("en");
    } catch(e) { }
};

var getTableHierarchy = function(tableName) {
    if(TABLE_CACHE[tableName] == undefined) {
        var tableHierarchy = new TableUtils(tableName);
        var path = j2js(tableHierarchy.getHierarchy()).slice(1);
        
        TABLE_CACHE[tableName] = path;
    }

    return TABLE_CACHE[tableName];    
};

var getTotalFlows = function() {
    var gr = new GlideAggregate("sys_hub_flow");
    gr.setWorkflow(false);
    gr.addQuery('sys_scope.scope', 'NOT LIKE', 'sn_%');
    gr.addQuery("type", "flow");
    gr.addAggregate("COUNT");
    gr.query();

    return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
};

var getFlows = function(range) {

	//
	// Cache all table variables
	//
	var triggerVariables = (function(){
		var gr = new GlideRecord("sys_variable_value");
		gr.setWorkflow(false);
        gr.addEncodedQuery("document=sys_hub_trigger_instance^variable.internal_type=table_name^NQdocument=sys_hub_trigger_instance^variable.internal_type=choice^variable.element=run_on_extended");
		gr.query();

		var triggerData = {};

		while(gr.next()) {
			var id = gr.getValue("document_key");
            var key = gr.variable.internal_type.toString();
            var value = gr.getValue("value");

            if(triggerData[id] == undefined) {
                triggerData[id] = {};
            }

            if(key == "table_name")
                triggerData[id].tableName = value;

            if(key == "choice")
                triggerData[id].runOnExtended = value;
		}

		return triggerData;

	})();

	//
	// Get associated table info
	//
	var tableDetails = (function(){
		var tableNames = {};
		var data = {};

		for(var id in triggerVariables){
            if(triggerVariables[id].tableName != undefined)
			    tableNames[triggerVariables[id].tableName] = true;
		}

		var gr = new GlideRecord("sys_db_object");
		gr.setWorkflow(false);
		gr.addEncodedQuery("nameIN" + Object.keys(tableNames).join(","));
		gr.query();

		while(gr.next()){
            var tableName = gr.getValue("name");

			data[tableName] = {
				name: tableName,
                path: getTableHierarchy(tableName)
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
		gr.orderByDesc("sys_created_on");
		gr.chooseWindow(range.start, range.end);
		gr.query();

		var data = {};

		while(gr.next()){
			data[gr.getUniqueValue()] = {
				name: gr.getValue("name")
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
			var triggerData = triggerVariables[gr.getUniqueValue()];
			var definitionId = gr.getValue("trigger_definition");
			var type = gr.getValue("trigger_type");

			if(TRIGGER_TYPES[definitionId]) {
				type = TRIGGER_TYPES[definitionId].value;
			}

			var trigger = {
				type: type
			};

			if(triggerData.tableName != undefined) {
				trigger.table = tableDetails[triggerData.tableName];
			}

            if(triggerData.runOnExtended != undefined) {
				trigger.runOnExtended = triggerData.runOnExtended;
			}

			flow.trigger = trigger;
		}
	})();

    //
	// Get flow logic
	//
	(function(){

        //
        // Logic definition
        //
        (function(){
            var gr = new GlideAggregate("sys_hub_flow_logic");
            gr.setWorkflow(false);
            gr.addEncodedQuery("flowIN" + Object.keys(flows).join(","));
            gr.groupBy("flow");
            gr.groupBy("logic_definition");
            gr.addAggregate("COUNT");
            gr.query();

            while(gr.next()){
                var logicDefinition = gr.logic_definition.getDisplayValue();
                var flowId = gr.getValue("flow");
			    var flow = flows[flowId];

                if(flow.logic == undefined) {
                    flow.logic = {};
                }

                flow.logic[logicDefinition] = parseInt(gr.getAggregate("COUNT"));
            }

        })();

        //
        // Actions
        //
        (function(){
            var gr = new GlideAggregate("sys_hub_action_instance");
            gr.setWorkflow(false);
            gr.addEncodedQuery("flowIN" + Object.keys(flows).join(","));
            gr.groupBy("flow");
            gr.groupBy("action_type");
            gr.addAggregate("COUNT");
            gr.query();

            while(gr.next()){
                var actionDefinition = gr.action_type.getDisplayValue();
                var flowId = gr.getValue("flow");
			    var flow = flows[flowId];

                if(flow.actions == undefined) {
                    flow.actions = {};
                }

                flow.actions[actionDefinition] = parseInt(gr.getAggregate("COUNT"));
            }

        })();

        //
        // Subflows
        //
        (function(){
            var gr = new GlideAggregate("sys_hub_sub_flow_instance");
            gr.setWorkflow(false);
            gr.addEncodedQuery("flowIN" + Object.keys(flows).join(","));
            gr.groupBy("flow");
            gr.addAggregate("COUNT");
            gr.query();

            while(gr.next()){
                var flowId = gr.getValue("flow");
			    var flow = flows[flowId];

                flow.subflows = parseInt(gr.getAggregate("COUNT"));
            }

        })();

	})();

	return flows;
};


(function(){

    setSessionLanguage();

    var ranges = {
        r1: { start: 0, end: 75 },
        r2: { start: 76, end: 150 },
        r3: { start: 151, end: 225 },
        r4: { start: 226, end: 300 },
    };

	var auditResults = {
		companyCode: getCompanyCode(),
        totalFlows: getTotalFlows(),
		flows: getFlows(ranges.r1)
	};

	gs.print(JSON.stringify(auditResults));

})();