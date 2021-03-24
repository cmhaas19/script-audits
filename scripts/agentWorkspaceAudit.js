
var pluginActivations = function() {
	return {
		agentWorkspace: pm.isRegistered("com.agent_workspace"),
		agentWorkspaceITSM: pm.isRegistered("com.snc.agent_workspace.itsm"),
		agentWorkspaceCSM: pm.isRegistered("com.snc.agent_workspace.csm")
	};
};

var workspaceRoles = function() {

	var getRoleCount = function(role) {
		var gr = new GlideAggregate("sys_user_has_role");
		gr.setWorkflow(false);	
		gr.addEncodedQuery("role.name=" + role + "^user.active=true");
		gr.groupBy("user");
		gr.query();

		return (gr.next() ? gr.getRowCount() : 0);
	};

	return {
		itil: getRoleCount("itil"),
		csmAgent: getRoleCount("sn_esm_agent"),
		workspaceAdmin: getRoleCount("workspace_admin"),
		workspaceListAdmin: getRoleCount("workspace_list_admin"),
		workspaceAgent: getRoleCount("workspace_agent")
	};
};

var workspaceForms = function() {
	var forms = {};

	(function(forms){
		var customerUpdates = (function(){
			var gr = new GlideRecord("sys_update_xml");
			gr.setWorkflow(false);
			gr.addEncodedQuery("type=Form Layout^view=workspace^action=INSERT_OR_UPDATE");
			gr.setLimit(2000);
			gr.query();

			var updates = {};

			while(gr.next()){
				var name = gr.getValue("name"),
					id = name.replace(/sys_ui_section_/g, "");

				updates[id] = true;
			}

			return updates;

		})();

		var gr = new GlideRecord("sys_ui_section");
		gr.setWorkflow(false);
		gr.addEncodedQuery("view.name=workspace");
		gr.orderBy("name");
		gr.setLimit(2000);
		gr.query();

		while(gr.next()) {
			var table = gr.getValue("name"),
				id = gr.getValue("sys_id");

			if(forms[table] == undefined)
				forms[table]= { customerModified: false };

			if(customerUpdates[id] != undefined)
				forms[table].customerModified = true;
		}

	})(forms);

	// 
	// Workspace UI actions
	//
	(function(forms){
		var gr = new GlideAggregate("sys_ui_action");
		gr.setWorkflow(false);
		gr.addEncodedQuery("active=true^form_button_v2=true^ORform_menu_button_v2=true");
		gr.addAggregate("COUNT");
		gr.groupBy("table");
		gr.query();

		while(gr.next()) {
			var table = gr.getValue("table"),
				count = parseInt(gr.getAggregate("COUNT"));

			if(forms[table] == undefined)
				forms[table] = {};

			forms[table].uiActionsEnabled = count;
		}
		

	})(forms);

	
	return forms;
};

var agentAssistConfigurations = function() {

	var searchFields = (function(){
		var gr = new GlideRecord("cxs_table_field_config");
		gr.setWorkflow(false);
		gr.setLimit(200);
		gr.addEncodedQuery("cxs_table_config.ui_type=workspace");
		gr.query();

		var fields = {};

		while(gr.next()){
			var configId = gr.getValue("cxs_table_config");

			if(fields[configId] == undefined)
				fields[configId] = [];

			fields[configId].push(gr.getValue("field"));
		}

		return fields;

	})();


	var gr = new GlideRecord("cxs_table_config");
	gr.setWorkflow(false);
	gr.addEncodedQuery("active=true^ui_type=workspace");
	gr.setLimit(100);
	gr.query();

	var configs = {};

	while(gr.next()) {
		var table = gr.getValue("table"),
			id = gr.getValue("sys_id");

		configs[table] = {
			searchContext: gr.cxs_context_config.getDisplayValue(),
			matchCondition: gr.getValue("match_condition"),
			searchAs: {
				enabled: (gr.getValue("search_as_active") == "true"),
				condition: gr.getValue("search_as_condition"),
				field: gr.getValue("search_as_field"),
			}
		}

		if(searchFields[id] != undefined)
			configs[table].fields = searchFields[id];
	}

	// Did the customer modify these configurations?

	return configs;

};

var listConfigurations = function() {
	var gr = new GlideRecord("sys_aw_list");
	gr.setWorkflow(false);
	gr.addEncodedQuery("active=true");
	gr.setLimit(500);
	gr.orderBy("category");
	gr.orderBy("order");
	gr.query();

	var lists = [];

	while(gr.next()) {
		lists.push({
			title: gr.getValue("title"),
			table: gr.getValue("table"),
			category: gr.category.getDisplayValue(),
			roles: gr.getValue("roles"),
			groups: gr.getValue("groups"),
			columns: gr.getValue("columns")
		})
	}

	return lists;
};

var guidedSetupStatus = function() {

	var setupStatus = {};

	//
	// Cache the status records to reduce queries
	//
	var contentStatus = (function() {
		var gr = new GlideRecord("gsw_status_of_content");
		gr.setWorkflow(false);
		gr.addEncodedQuery("content=a869052fdb081300c47f5f135e961910^ORcontent.parent=a869052fdb081300c47f5f135e961910^ORcontent.parent.parent=a869052fdb081300c47f5f135e961910");
		gr.query();

		var statuses = {};

		while(gr.next()){
			statuses[gr.getValue("content")] = {
				status: gr.status.getDisplayValue(),
				progress: gr.getValue("progress")
			}
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
	// Get the main Agent Workspace record
	//
	(function(){
		var gr = new GlideRecord("gsw_content_group");
		gr.setWorkflow(false);
		gr.addEncodedQuery("sys_id=a869052fdb081300c47f5f135e961910^active=true");
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
	gr.addEncodedQuery("parent=a869052fdb081300c47f5f135e961910^active=true");
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

var workspaceSettings = function() {
	var settings = {};

	(function(){
		var gr = new GlideRecord("sys_aw_master_config");
		gr.setWorkflow(false);
		gr.addEncodedQuery("name=Agent Workspace");
		gr.query();

		if(gr.next()){
			settings.globalSearch = gr.global_search.getDisplayValue();
			settings.catalog = gr.sc_catalog.getDisplayValue();
		}

	})();

	(function(){
		var gr = new GlideRecord("sys_aw_new_menu_item");
		gr.setWorkflow(false);
		gr.orderBy("order");
		gr.query();

		settings.newRecordMenu = [];

		while(gr.next()){
			settings.newRecordMenu.push(gr.getValue("table"));
		}

	})();
	
	return settings;
};

var ribbonSettings = function(){
	var gr = new GlideRecord("sys_aw_ribbon_setting");
	gr.setWorkflow(false);
	gr.orderBy("table");
	gr.orderBy("order")
	gr.query();

	var settings = {};

	while(gr.next()){
		var table = gr.getValue("table");

		if(settings[table] == undefined)
			settings[table] = [];

		settings[table].push({
			component: gr.component.getDisplayValue(),
			width: gr.getValue("width"),
			order: gr.getValue("order")
		});
	}

	return settings;
};

if(pluginActivations().agentWorkspace) {
	var auditResults = {
		pluginActivations: pluginActivations(),
		workspaceRoles: workspaceRoles(),
		workspaceForms: workspaceForms(),
		agentAssistConfigurations: agentAssistConfigurations(),
		listConfigurations: listConfigurations(),
		guidedSetupStatus: guidedSetupStatus(),
		workspaceSettings: workspaceSettings(),
		ribbonSettings: ribbonSettings()
	};

	gs.print(JSON.stringify(auditResults));
}





