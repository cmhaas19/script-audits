

//
// Get a distinct list of itil user id's
//
var itilUsers = (function(){

	var users = new GlideAggregate("sys_user_has_role");
	users.setWorkflow(false);
	users.addEncodedQuery("user.active=true^role.name=itil");
	users.addAggregate("COUNT");
	users.groupBy("user");
	users.setLimit(1000);
	users.query();

	var userIds = [];

	while(users.next()){
		userIds.push(users.getValue("user"));
	}

	return userIds;

})();


//
// How often do itil users order on behalf of someone and use an order guide?
//
function getOrderGuideStats() {

	var totalItems = (function() {
		var gr = new GlideAggregate("sc_req_item");
		gr.addNotNullQuery("request.requested_for");
		gr.addEncodedQuery("request.opened_byNSAMEASrequest.requested_for"); 
		gr.addEncodedQuery("request.opened_byIN" + itilUsers.join(","));
		gr.addAggregate('COUNT');
		gr.setWorkflow(false);
		gr.query();

		return (gr.next() ? gr.getAggregate("COUNT") : 0);

	})();

	var totalOrderGuideItems = (function() {
		var gr = new GlideAggregate("sc_req_item");
		gr.addNotNullQuery("request.requested_for");
		gr.addNotNullQuery("order_guide");
		gr.addEncodedQuery("request.opened_byNSAMEASrequest.requested_for"); 
		gr.addEncodedQuery("request.opened_byIN" + itilUsers.join(","));
		gr.addAggregate('COUNT');
		gr.setWorkflow(false);
		gr.query();

		return (gr.next() ? gr.getAggregate("COUNT") : 0);

	})();

	return {
		totalItems: totalItems,
		totalOrderGuideItems: totalOrderGuideItems
	};
}


//
// How often do itil users request more than 1 item on behalf of someone?
//
function getOrderItemStats() {

	var totalRequests = (function() {
		var gr = new GlideAggregate("sc_req_item");
		gr.addNotNullQuery("request.requested_for");
		gr.addEncodedQuery("request.opened_byNSAMEASrequest.requested_for"); 
		gr.addEncodedQuery("request.opened_byIN" + itilUsers.join(","));
		gr.addAggregate('COUNT');
		gr.setWorkflow(false);
		gr.query();

		return (gr.next() ? gr.getAggregate("COUNT") : 0);

	})();


	var totalWithMultipleItems = (function() {
		var gr = new GlideAggregate("sc_req_item");
		gr.addNotNullQuery("request.requested_for");
		gr.addEncodedQuery("request.opened_byNSAMEASrequest.requested_for"); 
		gr.addEncodedQuery("request.opened_byIN" + itilUsers.join(","));
		gr.groupBy("request");
		gr.addHaving("COUNT", ">", "1")
		gr.setWorkflow(false);
		gr.query();

		return (gr.next() ? gr.getRowCount() : 0);

	})();

	return {
		totalRequests: totalRequests,
		totalWithMultipleItems: totalWithMultipleItems
	};
}

//
// Which forms have Contextual Search?
// What table configurations does the customer have and what searcher are they using?
//
function getContextualSearchInfo() {

	var getContext = function(id) {
		var context = new GlideRecord("cxs_context_config");
		context.setWorkflow(false);
		context.get(id);

		return {
			name: context.getValue("name"),
			searcher: context.cxs_searcher_config.getDisplayValue(),
		};
	};

	var getFormSectionDetails = function(id) {
		var gr = new GlideRecord("sys_ui_section");
		gr.setWorkflow(false);
		
		if(gr.get(id))
			return { table: gr.getValue("name"), view: gr.view.getDisplayValue() };
	};

	var getSearchConfigs = function() {
		var configs = [];

		var gr = new GlideRecord("cxs_table_config");
		gr.setWorkflow(false);
		gr.addActiveQuery();
		gr.query();

		while(gr.next()) {
			configs.push({
				table: gr.getValue("table"),
				context: getContext(gr.cxs_context_config)
			});
		}

		return configs;
	};

	var getForms = function() {
		var gr = new GlideRecord("sys_ui_element");
		gr.setWorkflow(false);
		gr.addEncodedQuery("sys_ui_formatter=11eb1622eb1121003623666cd206fe56");
		gr.query();

		var forms = [];

		while(gr.next()){
			var section = getFormSectionDetails(gr.sys_ui_section);

			if(section)
				forms.push(section);
		}

		return forms;
	}

	return {
		forms: getForms(),
		configs: getSearchConfigs()
	};
}

var output = {
	orderGuideStats: getOrderGuideStats(),
	orderItemStats: getOrderItemStats(),
	contextualSearch: getContextualSearchInfo()
};



gs.print(JSON.stringify(output));



