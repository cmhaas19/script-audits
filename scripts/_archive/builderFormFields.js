

var getArtifactTables = function() {
	var tables = [];

	var gr = new GlideRecord("sys_db_object");
	gr.setWorkflow(false);
	gr.addEncodedQuery("super_class.name=sys_metadata");
	gr.query();

	while(gr.next()) {
		var tableName = gr.getValue("name");
		tables.push(tableName);
	}

	return tables;
};


var getTableFields = function(tables) {
	var fields = {};

	var gr = new GlideAggregate("sys_dictionary");
	gr.setWorkflow(false);
	gr.addEncodedQuery("internal_type!=collection^nameIN" + tables.join(","));
	gr.groupBy("internal_type");
	gr.addAggregate("COUNT");
	gr.query();

	while(gr.next()) {
		var internalType = gr.internal_type.toString(),
			count = gr.getAggregate("COUNT");

		fields[internalType] = count;
	}

	return fields;
};

var fields = getTableFields(getArtifactTables());

gs.print(JSON.stringify(fields));