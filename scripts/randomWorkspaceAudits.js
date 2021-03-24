
var getFulfillerCount = function() {
	var gr = new GlideAggregate("sys_user_has_role");
	gr.setWorkflow(false);	
	gr.addEncodedQuery("role.name!=snc_internal^role.name!=snc_external^role.name!=approver_user^user.active=true^user.last_login_time>javascript:gs.dateGenerate('2018-02-01','00:00:00')");
	gr.groupBy("user");
	gr.query();

	return (gr.next() ? gr.getRowCount() : 0);
};

var addFulfillerJoinQuery = function(glideRecord) {
	var fulfillers = glideRecord.addJoinQuery("sys_user_has_role", "user", "user");
	fulfillers.addCondition("role.name", "=", "itil");
	fulfillers.addCondition("user.active", "=", "true");
	fulfillers.addCondition("user.last_login_time", ">", "javascript:gs.dateGenerate('2018-02-01','00:00:00')");
};

var themeAudit = function() {
	var totalCount = 0;
	var results = {
		fulfillerCount: 0,
		defaultTheme: 0,
		themes: {}
	};

	var fulfillerCount = getFulfillerCount();

	var allThemes = (function(){
		var themes = {};
		var gr = new GlideRecord("sys_ui_theme");
		gr.setWorkflow(false);
		gr.query();

		while(gr.next()){
			themes[gr.getValue("sys_id")] = gr.getValue("name");
		}

		return themes;

	})();

	var preference = new GlideAggregate("sys_user_preference");
	preference.setWorkflow(false);
	preference.addEncodedQuery("name=glide.css.theme.ui16^userISNOTEMPTY^user.active=true^user.last_login_time>javascript:gs.dateGenerate('2018-02-01','00:00:00')");
	preference.addAggregate("COUNT");
	preference.groupBy("value");

	addFulfillerJoinQuery(preference);

	preference.query();

	while(preference.next()) {
		var themeId = preference.value;
		var count = parseInt(preference.getAggregate("COUNT"));
		var themeName = allThemes[themeId];

		if(themeName)
			results.themes[themeName] = count;
		else
			results.themes[themeId] = count;

		totalCount += count;
	}

	results.defaultTheme = Math.abs(totalCount - fulfillerCount);
	results.fulfillerCount = fulfillerCount;

	return results;

};

var accessibilityEnabled = function() {
	var results = {
		activeCount: 0
	};

	var fulfillerCount = getFulfillerCount();

	var defaultValue = (function() {
		var gr = new GlideRecord("sys_user_preference");
		gr.setWorkflow(false);
		gr.addEncodedQuery("name=glide.ui.accessibility^userISEMPTY");
		gr.query();
		
		return gr.next() ? gr.getValue("value") == "true" : false;

	})();

	var preferenceCount = (function() {
		var preference = new GlideAggregate("sys_user_preference");
		preference.setWorkflow(false);
		preference.addAggregate('COUNT');
		preference.addEncodedQuery("name=glide.ui.accessibility^value=" + !defaultValue);

		addFulfillerJoinQuery(preference);

		preference.query();

		return preference.next() ? parseInt(preference.getAggregate("COUNT")) : 0;

	})();

	if(defaultValue == false) {
		results.activeCount = preferenceCount;
	} else {
		results.activeCount = fulfillerCount - preferenceCount;
	}

	results.fulfillerCount = fulfillerCount;
	results.defaultValue = defaultValue;

	return results;
};

var accessibilityTooltipsEnabled = function() {
	var results = {
		activeCount: 0
	};

	var fulfillerCount = getFulfillerCount();

	var preferenceCount = (function() {
		var preference = new GlideAggregate("sys_user_preference");
		preference.setWorkflow(false);
		preference.addAggregate('COUNT');
		preference.addEncodedQuery("name=glide.ui.accessibility.accessible.tooltips^value=true");

		addFulfillerJoinQuery(preference);

		var enabled = preference.addJoinQuery("sys_user_preference", "user", "user");
		enabled.addCondition("name", "=", "glide.ui.accessibility");
		enabled.addCondition("value", "=", "true");

		preference.query();

		return preference.next() ? parseInt(preference.getAggregate("COUNT")) : 0;

	})();

	results.activeCount = preferenceCount;
	results.fulfillerCount = fulfillerCount;

	return results;
};



var results = {
	themes: themeAudit(),
	accessibilityEnabled: accessibilityEnabled(),
	accessibilityTooltipsEnabled: accessibilityTooltipsEnabled()
};


gs.print(JSON.stringify(results));


