
var hrProfileAudit = function() {

	if(!pm.isRegistered("com.sn_hr_core"))
		return;

	var getData = function(columnName) {

		var totalCaseCount = (function() {

			var gr = new GlideAggregate("sn_hr_core_case");
			gr.setWorkflow(false);
			gr.addAggregate("COUNT");
			gr.addEncodedQuery(columnName + "ISNOTEMPTY");
			gr.query();

			return gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0;
		
		})();

		var totalWithProfile = (function() {

			var gr = new GlideAggregate("sn_hr_core_case");
			gr.setWorkflow(false);
			gr.addAggregate("COUNT");
			gr.addEncodedQuery(columnName + "ISNOTEMPTY");
			gr.addJoinQuery("sn_hr_core_profile", columnName, "user");
			gr.query();

			return gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0;

		})();

		return {
			totalCaseCount: totalCaseCount,
			totalWithProfile: totalWithProfile,
			totalWithoutProfile: (totalCaseCount - totalWithProfile)
		};

	};

	return {
		openedFor: getData("opened_for"),
		subjectPerson: getData("subject_person")
	};
};



var results = {
	hrProfileAudit: hrProfileAudit()
};

gs.print(JSON.stringify(results));