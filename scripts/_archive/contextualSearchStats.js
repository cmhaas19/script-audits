
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

		var forms = {};

		while(gr.next()){
			var section = getFormSectionDetails(gr.sys_ui_section);

			if(section) {
				if(forms[section.table] == undefined)
					forms[section.table] = [];

				forms[section.table].push(section.view);
			}
		}

		return forms;
	};

	var getRelevantDocStats = function() {

		var getStats = function(daysAgo) {
			var gr = new GlideAggregate("cxs_rel_doc_detail");
			gr.addEncodedQuery("sys_created_onRELATIVEGT@dayofweek@ago@" + daysAgo);
			gr.addAggregate("COUNT");
			gr.groupBy("relevance");
			gr.groupBy("relevant_doc_table");
			gr.setWorkflow(false);
			gr.query();

			var results = {};

			while(gr.next()) {
				var relevance = gr.getValue("relevance"),
					table = gr.getValue("relevant_doc_table"),
					count = gr.getAggregate("COUNT");

				if(results[table] == undefined)
					results[table] = {};

				results[table][relevance] = count;
			}

			return results;
		};


		return {
			"30": getStats(30),
			"90": getStats(90),
			"180": getStats(180),
			"365": getStats(365)
		};
	};

	return {
		forms: getForms(),
		configs: getSearchConfigs(),
		relevantDocStats: getRelevantDocStats()
	};
}

var output = getContextualSearchInfo();

gs.print(JSON.stringify(output));
