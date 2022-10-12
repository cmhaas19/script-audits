
var getLabels = function(daysAgo) {
	var gr = new GlideAggregate("label");
	gr.setWorkflow(false);
	gr.addEncodedQuery("sys_class_name=label^sys_created_by!=system^type=standard^viewable_by!=NULL^sys_created_onRELATIVEGT@dayofweek@ago@" + daysAgo);
	gr.groupBy("viewable_by");
	gr.addAggregate("COUNT");

	var entryJoin = gr.addJoinQuery("label_entry", "sys_id", "label");
	entryJoin.addCondition("table", "!=", "kb_knowledge");
	entryJoin.addCondition("table", "!=", "kb_social_qa_question");

	gr.query();

	var result = {};

	while(gr.next()) {
		var viewable = gr.viewable_by,
			count = gr.getAggregate("COUNT");

		result[viewable] = parseInt(count);
	}

	return result;
}

var getLabelTables = function(daysAgo) {
	var gr = new GlideAggregate("label_entry");
	gr.setWorkflow(false);
	gr.addEncodedQuery("table!=kb_knowledge^table!=kb_social_qa_question^label.sys_class_name=label^label.sys_created_by!=system^label.type=standard^label.viewable_by!=NULL^label.sys_created_onRELATIVEGT@dayofweek@ago@" + daysAgo);
	gr.groupBy("table");
	gr.addAggregate("COUNT");
	gr.query();

	var result = {};

	while(gr.next()) {
		var table = gr.table,
			count = gr.getAggregate("COUNT");

		result[table] = parseInt(count);
	}

	return result;

};

var results = {
	labelsByVisibility: {
		"30": getLabels(30),
		"60": getLabels(60),
		"90": getLabels(90),
		"180": getLabels(180) 
	},
	labelsByTable: {
		"30": getLabelTables(30),
		"60": getLabelTables(60),
		"90": getLabelTables(90),
		"180": getLabelTables(180) 
	}
};

gs.print(JSON.stringify(results));
