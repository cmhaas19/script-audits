
var sections = (function() {
	var data = {};

	var gr = new GlideRecord("sys_ui_section");
	gr.setWorkflow(false);
	gr.addEncodedQuery("nameINincident,problem,change_request,sc_request,sc_req_item,sn_customerservice_case,customer_account,customer_contact,csm_consumer,ast_contract,service_entitlement,csm_order,csm_order_line_item^view=Default view^ORview=e154efb9db2972003a84f8ecbf9619a2");
	gr.query();

	while(gr.next()) {
		var id = gr.getValue("sys_id"),
			name = gr.getValue("name");

		data[id] = name;
	}
	
	return {
		findSectionById: function(id) {
			return data[id];
		}
	};

})();

var results = (function(){
	var map = {};

	return {
		add: function(name, type) {
			if(map[name] == undefined)
				map[name] = {};

			if(map[name][type] == undefined)
				map[name][type] = 0;

			map[name][type]++;
		},

		print: function() {
			var output = "";

			for(var prop in map){
				var types = "";

				if(output.length)
					output += "^";

				output += prop;

				for(var subprop in map[prop]){
					output += "~" + subprop + "=" + map[prop][subprop];
				}
			}

			return output;
		}
	};

})();

var gr = new GlideRecord("sys_ui_element");
gr.setWorkflow(false);
gr.addEncodedQuery("sys_ui_section.nameINincident,problem,change_request,sc_request,sc_req_item,sn_customerservice_case,customer_account,customer_contact,csm_consumer,ast_contract,service_entitlement,csm_order,csm_order_line_item^sys_ui_section.view=Default view^ORsys_ui_section.view=e154efb9db2972003a84f8ecbf9619a2^typeNOT IN.end_split,.split,.begin_split^type!=NULL");
gr.query();

while(gr.next()) {
	var type = gr.getValue("type"),
		sectionId = gr.getValue("sys_ui_section"),
		sectionName = sections.findSectionById(sectionId);

	results.add(sectionName, type);
}

gs.print(results.print());

// Output: Incident~Charts=10~Formatters=5^Problem


