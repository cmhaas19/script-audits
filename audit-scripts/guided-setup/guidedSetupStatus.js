

var getGuidedSetups = function() {
    
    var setups = {};

    var gr = new GlideRecord("gsw_content");

    if(!gr.isValid())
        return setups;
    
    gr.setWorkflow(false);
    gr.addEncodedQuery("parentISEMPTY^active=true");
    gr.query();

    while(gr.next()){
        var id = gr.getUniqueValue();

        setups[id] = {
            name: gr.getValue("title"),
            data: getGuidedSetupStatus(id)
        };
    }

    return setups;
};


var getGuidedSetupStatus = function(guidedSetupContentId) {

	var setupStatus = {};

	//
	// Cache the status records to reduce queries
	//
	var contentStatus = (function() {
		var gr = new GlideRecord("gsw_status_of_content");
		gr.setWorkflow(false);
		gr.addEncodedQuery("content=" + guidedSetupContentId + "^ORcontent.parent=" + guidedSetupContentId + "^ORcontent.parent.parent=" + guidedSetupContentId);
		gr.query();

		var statuses = {};

		while(gr.next()){
			statuses[gr.getValue("content")] = {
				status: gr.status.getDisplayValue(),
				progress: gr.getValue("progress")
			};
		}

		return {
			get: function(contentId) {
				if(statuses[contentId])
					return statuses[contentId];
				else
					return { status: "Not Started", progress: 0 };
			}
		};

	})();

	//
	// Get the main record
	//
	(function(){
		var gr = new GlideRecord("gsw_content_group");
		gr.setWorkflow(false);
		gr.addEncodedQuery("sys_id=" + guidedSetupContentId);
		gr.query();

		if(gr.next()){
			var currentStatus = contentStatus.get(gr.getUniqueValue());

			setupStatus.name = gr.getValue("title");
			setupStatus.status = currentStatus.status;
			setupStatus.progress = currentStatus.progress;
			setupStatus.steps = [];
		}

	})();

	var getInfoSteps = function(id) {
		var gr = new GlideRecord("gsw_content_information");
		gr.setWorkflow(false);
		gr.addEncodedQuery("parent=" + id);
		gr.query();

		var steps = [];

		while(gr.next()){
			var currentStatus = contentStatus.get(gr.getUniqueValue());

			steps.push({
				name: gr.getValue("title"),
				status: currentStatus.status,
				progress: currentStatus.progress
			});
		}

		return steps;
	};

	//
	// Get the child steps
	//
	var gr = new GlideRecord("gsw_content_group");
	gr.setWorkflow(false);
	gr.addEncodedQuery("parent=" + guidedSetupContentId);
	gr.query();

	while(gr.next()) {
		var currentStatus = contentStatus.get(gr.getUniqueValue());

		setupStatus.steps.push({
			name: gr.getValue("title"),
			status: currentStatus.status,
			progress: currentStatus.progress,
			steps: getInfoSteps(gr.getUniqueValue())
		});
	}

	return setupStatus;
};

(function() {
    var setups = getGuidedSetups();
    return gs.print(JSON.stringify(setups));

})();