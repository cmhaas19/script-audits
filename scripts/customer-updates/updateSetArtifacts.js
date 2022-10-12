

var getTotalUpdateSets = function() {
	var gr = new GlideAggregate("sys_update_set");
	gr.setWorkflow(false);
	gr.addAggregate("COUNT");
	gr.addEncodedQuery("install_dateRELATIVEGE@year@ago@1");
	gr.query(); 

	return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
};

var getTotalArtifacts = function() {
	var gr = new GlideAggregate("sys_update_xml");
	gr.setWorkflow(false);
	gr.addAggregate("COUNT");
	gr.addEncodedQuery("update_set.install_dateRELATIVEGE@year@ago@1");
	gr.query(); 

	return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
};

var getUpdateSetArtifacts = function() {
	var updateSets = {};

	var gr = new GlideAggregate("sys_update_xml");
	gr.setWorkflow(false);
	gr.setLimit(10000);
	gr.addAggregate("COUNT");
	gr.addEncodedQuery("update_set.install_dateRELATIVEGE@year@ago@1");
	gr.groupBy("update_set");
	gr.groupBy("type");
	gr.query(); 
	
	//gs.print(gr.getRowCount());

	while(gr.next()){
		var count = parseInt(gr.getAggregate("COUNT")),
			updateSet = gr.update_set.toString(),
			updateType = gr.type.toString();

		if(updateSets[updateType] == undefined)
			updateSets[updateType] = { totalUpdateSets: 0, totalArtifacts: 0 };

		updateSets[updateType].totalUpdateSets++;
		updateSets[updateType].totalArtifacts += count;
	}

	return updateSets;

};


(function(){

	var auditResults = {
		totalUpdateSets: getTotalUpdateSets(),
		totalArtifacts: getTotalArtifacts(),
		updateSetArtifacts: getUpdateSetArtifacts()
	};

	gs.print(JSON.stringify(auditResults));

})();