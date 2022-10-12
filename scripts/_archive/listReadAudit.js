

var addFulfillerJoin = function(gr) {
	var fulfillers = gr.addJoinQuery("sys_user_has_role", "user", "user");
	fulfillers.addCondition("role.name", "!=", "snc_internal");
	fulfillers.addCondition("role.name", "!=", "snc_external");
	fulfillers.addCondition("role.name", "!=", "approver_user");
};

var executeListV3Audit = function() {

	var result = {
		pluginEnabled: pm.isRegistered("com.glide.ui.list_v3"),
		propertyEnabled: (gs.getProperty("glide.ui.list_v3.enable", false) == "true")
	};

	result.enabled = (result.pluginEnabled && result.propertyEnabled);

	return result;
};

var userPreferenceAudit = function(key) {

	var fulfillerCount = (function() {
		var gr = new GlideAggregate("sys_user_has_role");
		gr.setWorkflow(false);	
		gr.addEncodedQuery("role.name!=snc_internal^role.name!=snc_external^role.name!=approver_user^user.active=true^user.last_login_time>javascript:gs.dateGenerate('2018-03-01','00:00:00')");
		gr.groupBy("user");
		gr.query();

		return (gr.next() ? gr.getRowCount() : 0);

	})();

	var defaultValue = (function(){
		var gr = new GlideRecord("sys_user_preference");
		gr.setWorkflow(false);
		gr.addEncodedQuery("name=" + key + "^userISEMPTY");
		gr.orderByDesc("sys_updated_on");
		gr.query();
		
		return gr.next() ? (gr.getValue("value") == "true") : false;

	})();

	var oppositeCount = (function() {
		var gr = new GlideAggregate("sys_user_preference");
		gr.setWorkflow(false);
		gr.addEncodedQuery("name=" + key + "^user!=NULL^user.active=true^user.last_login_time>javascript:gs.dateGenerate('2018-03-01','00:00:00')^value=" + !defaultValue);
		gr.groupBy("user");

		addFulfillerJoin(gr);

		gr.query();

		return gr.next() ? parseInt(gr.getRowCount()) : 0;

	})();

	return {
		fulfillerCount: fulfillerCount,
		defaultValue: defaultValue,
		oppositeCount: oppositeCount,
		enabledCount: (defaultValue == true ? oppositeCount : (fulfillerCount - oppositeCount))
	};
};

var executeUi15Audit = function() {

	var preferenceAudit = userPreferenceAudit("use.concourse"),
		fulfillerCount = preferenceAudit.fulfillerCount,
		defaultValue = preferenceAudit.defaultValue,
		oppositeCount = preferenceAudit.oppositeCount;

	var splitViewEnabledCount = (function() {

		var splitView = {
			vertical: 0,
			horizontal: 0
		};

		if(defaultValue == true) {

			//
			// Concourse is the default so look specifically for users with concourse disabled and currently in split view mode
			//
			var getCount = function(value) {
				var state = new GlideAggregate("sys_user_preference");
				state.setWorkflow(false);
				state.addEncodedQuery("valueLIKE\"" + value + "\":false^name=glide.ui.navpage.state^userISNOTEMPTY^user.active=true^user.last_login_time>javascript:gs.dateGenerate('2018-03-01','00:00:00')");
				state.groupBy("user");

				var concourse = state.addJoinQuery("sys_user_preference", "user", "user");
				concourse.addCondition("name", "=", "use.concourse");
				concourse.addCondition("value", "=", "false");

				addFulfillerJoin(state);

				state.query();

				return state.next() ? parseInt(state.getRowCount()) : 0;
			};

			splitView.vertical = getCount("main.east.isClosed");
			splitView.horizontal = getCount("main.south.isClosed");			

		} else {

			//
			// UI15 is the default so just look for where split view is currently in use
			//
			var getCount = function(value) {
				var gr = new GlideAggregate("sys_user_preference");
				gr.setWorkflow(false);
				gr.addEncodedQuery("name=glide.ui.navpage.state^user.active=true^user.last_login_time>javascript:gs.dateGenerate('2018-03-01','00:00:00')^valueLIKE\"" + value + "\":false");
				gr.groupBy("user");

				addFulfillerJoin(gr);

				gr.query();

				return gr.next() ? parseInt(gr.getRowCount()) : 0;
			};

			splitView.vertical = getCount("main.east.isClosed");
			splitView.horizontal = getCount("main.south.isClosed");
		}

		return splitView;

	})();

	return {
		fulfillerCount: fulfillerCount,
		enabledByDefault: !defaultValue,
		enabledUserCount: (defaultValue == true ? oppositeCount : (fulfillerCount - oppositeCount)),
		splitViewEnabledCount: splitViewEnabledCount
	};
};

var executeListDetailAudit = function() {
	var results = {
		detailRowsEnabled: false,
		tables: {}
	};

	var getAttributeValue = function(attributes) {
		var column = "";

		attributes.split(",").forEach(function(pair){
			var keyValue = pair.split("=");

			if(keyValue.length >= 2) {
				var key = keyValue[0].toLowerCase();
				var value = keyValue[1].toLowerCase();

				if(key.indexOf("detail_row") !== -1)
					column = value;
			}			
		});

		return column;
	};

	results.detailRowsEnabled = (function() {
		var gr = new GlideRecord("sys_properties");
		gr.setWorkflow(false);
		gr.addEncodedQuery("name=glide.ui.list.detail_row^value=true");
		gr.query();

		return gr.next();

	})();

	if(results.detailRowsEnabled) {
		var gr = new GlideRecord("sys_dictionary");
		gr.setWorkflow(false);
		gr.addEncodedQuery("internal_type=collection^attributesLIKEdetail_row");
		gr.setLimit(1000);
		gr.query();

		while(gr.next()){
			var table = gr.getValue("name"),
				attributes = gr.getValue("attributes"),
				column = getAttributeValue(attributes);

			results.tables[table] = column;
		};
	}

	return results;

};

var executeListHierarchyAudit = function() {

	var hierarchyEnabledTables = (function(){
		var gr = new GlideRecord("sys_ui_list_control");
		gr.setWorkflow(false);
		gr.addEncodedQuery("related_listISEMPTY^hierarchical_lists=true");
		gr.setLimit(1000);
		gr.query();

		var tables = {};

		while(gr.next()) {
			var table = gr.getValue("name");

			if(tables[table] == undefined)
				tables[table] = {};
		}

		return Object.getOwnPropertyNames(tables);

	})();

	var gr = new GlideRecord("sys_ui_related_list_entry");
	gr.setWorkflow(false);
	gr.addEncodedQuery("list_id.nameIN" + hierarchyEnabledTables.join(",") + "^list_id.view.sys_name=Default view");
	gr.orderBy("list_id");
	gr.orderBy("position");
	gr.query();

	var relatedLists = {};

	while(gr.next()) {
		var table = gr.list_id.name,
			relatedList = gr.getValue("related_list");

		if(relatedLists[table] == undefined)
			relatedLists[table] = [];

		relatedLists[table].push(relatedList);
	}

	var results = {};

	hierarchyEnabledTables.forEach(function(table){
		results[table] = [];

		if(relatedLists[table])
			results[table] = relatedLists[table];
	});

	return results;

};

var executeListSearchHeaderAudit = function() {	
	var audit = userPreferenceAudit("glide.ui.list_header_search.open");
	var results = {
		fulfillerCount: audit.fulfillerCount
	};

	if(audit.defaultValue == true)
		results.enabledCount = audit.fulfillerCount - audit.oppositeCount;
	else
		results.enabledCount = audit.oppositeCount;

	return results;
};

var auditResults = {
	listV3: executeListV3Audit(),
	ui15: executeUi15Audit(),
	listHierarchy: executeListHierarchyAudit(),
	detailRows: executeListDetailAudit(),
	listSearchHeader: executeListSearchHeaderAudit()
};

gs.print(JSON.stringify(auditResults));
