
var variableTypeData = (function(){

	var variableTypes = {
		14: {
			label: "Macro",
			totalCatalogItems: 0,
			catalogItems: []
		},
		17: {
			label: "Macro with label",
			totalCatalogItems: 0,
			catalogItems: []
		},
		15: {
			label: "UI Page",
			totalCatalogItems: 0,
			catalogItems: []
		},
		21: {
			label: "List Collector",
			totalCatalogItems: 0,
			catalogItems: []
		}/*,
		// For testing
		5: {
			label: "Select Box",
			totalCatalogItems: 0,
			catalogItems: []
		}
		*/
	};

	var gr = new GlideAggregate("item_option_new");
	gr.setWorkflow(false);
	gr.addEncodedQuery("active=true^cat_item!=NULL^typeIN" + Object.keys(variableTypes).join(","));
	gr.addAggregate("COUNT");
	gr.groupBy("cat_item");
	gr.groupBy("type");
	gr.query();

	while(gr.next()) {
		var catalogItem = gr.cat_item,
			type = gr.type,
			count = gr.getAggregate("COUNT");

		var variableType = variableTypes[type];

		if(variableType) {

			// Keep track of how many items there actual are
			variableType.totalCatalogItems += parseInt(count);

			// But don't store more than 1,000 per type
			if(variableType.catalogItems.length < 1000)
				variableType.catalogItems.push(catalogItem.toString());
		}
	}

	return variableTypes;

})();


(function(){
	var DAYS = "180";
	var results = {};

	//
	// Get total request items closed in the last X days
	//
	(function() {

		var gr = new GlideAggregate("sc_req_item");
		gr.setWorkflow(false);
		gr.addEncodedQuery("active=false^closed_atRELATIVEGE@dayofweek@ago@" + DAYS);
		gr.addAggregate("COUNT");
		gr.query();

		results.totalRequestItems =  (gr.next() ? gr.getAggregate("COUNT") : 0);

	})();

	//
	// For each variable type, get the count of req items associated to its catalog items that were closed in the last X days
	//
	for(var prop in variableTypeData) {

		var variableType = variableTypeData[prop];

		var gr = new GlideAggregate("sc_req_item");
		gr.setWorkflow(false);
		gr.addEncodedQuery("active=false^cat_itemIN" + variableType.catalogItems.join(",") + "^closed_atRELATIVEGE@dayofweek@ago@" + DAYS);
		gr.addAggregate("COUNT");
		gr.query();

		results[variableType.label] = {
			totalRequestItems: (gr.next() ? gr.getAggregate("COUNT") : 0),
			totalCatalogItems: variableType.totalCatalogItems
		};
	}

	gs.print(JSON.stringify(results));

})();





