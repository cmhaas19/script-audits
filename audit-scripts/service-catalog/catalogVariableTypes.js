
var stringify = (function () {
  var toString = Object.prototype.toString;
  var isArray = Array.isArray || function (a) { return toString.call(a) === '[object Array]'; };
  var escMap = {'"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t'};
  var escFunc = function (m) { return escMap[m] || '\\u' + (m.charCodeAt(0) + 0x10000).toString(16).substr(1); };
  var escRE = /[\\"\u0000-\u001F\u2028\u2029]/g;
  return function stringify(value) {
    if (value == null) {
      return 'null';
    } else if (typeof value === 'number') {
      return isFinite(value) ? value.toString() : 'null';
    } else if (typeof value === 'boolean') {
      return value.toString();
    } else if (typeof value === 'object') {
      if (typeof value.toJSON === 'function') {
        return stringify(value.toJSON());
      } else if (isArray(value)) {
        var res = '[';
        for (var i = 0; i < value.length; i++)
          res += (i ? ', ' : '') + stringify(value[i]);
        return res + ']';
      } else if (toString.call(value) === '[object Object]') {
        var tmp = [];
        for (var k in value) {
          if (value.hasOwnProperty(k))
            tmp.push(stringify(k) + ': ' + stringify(value[k]));
        }
        return '{' + tmp.join(', ') + '}';
      }
    }
    return '"' + value.toString().replace(escRE, escFunc) + '"';
  };
})();

var trim = function(text) {
	return text.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
};

var getCatalogVariableTypes = function() {

	var returnValue = {
		itsm: [],
		csm: []
	};

	var variableTypes = (function() {
		var types = {};

		var gr = new GlideRecord("sys_choice");
		gr.setWorkflow(false);
		gr.addEncodedQuery("name=question^element=type^inactive=false");
		gr.query();

		while(gr.next()) {
			var value = gr.getValue("value"),
				label = gr.getValue("label");

			types[value] = label;
		}
		
		return {
			getLabelByValue: function(value) {
				return types[value];
			}
		};

	})();

	var businessUnit = pm.isRegistered("com.sn_customerservice") ? "csm" : "itsm";

	returnValue[businessUnit] = (function() {
		var types = {};
		var typesArray = [];

		var gr = new GlideRecord("item_option_new");
		gr.setWorkflow(false);
		gr.addEncodedQuery("active=true");
		gr.query();

		while(gr.next()) {
			var value = gr.getValue("type"),
				label = variableTypes.getLabelByValue(value);

			if(label) {
				if(types[label] == undefined)
					types[label] = 0;

				types[label]++;
			}
		}

		for(var prop in types) {
			var o = {};
			o[prop] = types[prop];
			typesArray.push(o);			
		}

		return typesArray;

	})();

	return returnValue;
	
};

/*
	Return: {
		totalUsers: 5000,
		defaultSetting: 20,
		settings: {
			"20": 1500,
			"50": 3500,
			"100": 100 
		}
	}
*/
var getRecordsPerPageSetting = function() {

	var returnValue = {
		totalUsers: 0,
		defaultSetting: "20",
		settings: {}
	};

	var defaultValue = "20";

	//
	// Grab the default value
	//
	var gr = new GlideRecord("sys_user_preference");
	gr.setWorkflow(false);
	gr.addEncodedQuery("name=rowcount^user=NULL");
	gr.query();

	if(gr.next())
		returnValue.defaultSetting = gr.getValue("value");

	//
	// Query for all active itil or itil_admin users who have logged in within the last 30 days
	//
	var users = new GlideRecord("sys_user_has_role");
	users.setWorkflow(false);
	users.addEncodedQuery("user.active=true^role.nameINitil,itil_admin^user.last_login_timeISNOTEMPTY^user.last_login_time>javascript:gs.dateGenerate('2017-07-01','00:00:00')");
	users.setLimit(1000);
	users.query();

	var map = {},
		userIds = [];

	while(users.next()){
		var id = users.getValue("user");

		if(map[id] == undefined){
			map[id] = id;
			userIds.push(id);
		}
	}

	returnValue.totalUsers = userIds.length;

	//
	// Get count of preferences that are opposite of the default value
	//
	var preference = new GlideAggregate("sys_user_preference");
	preference.setWorkflow(false);
	preference.addAggregate('COUNT', 'value');
	preference.addEncodedQuery("name=rowcount^value!=" + returnValue.defaultSetting + "^userIN" + userIds.join(","));
	preference.query();

	var preferenceCount = 0;

	while(preference.next()) {
		var value = preference.value,
			count = preference.getAggregate('COUNT', 'value');

		preferenceCount += parseInt(count);

		returnValue.settings[value] = parseInt(count);
	}

	returnValue.settings[returnValue.defaultSetting] = (returnValue.totalUsers - preferenceCount);

	return returnValue;
};


/*
	return {
		incident: { 'background-color': 25, 'width': 99 }
	}
*/
var getFieldStyles = function() {
	var styles = {};

	var gr = new GlideRecord("sys_ui_style");
	gr.setWorkflow(false);
	gr.addEncodedQuery("nameINtask,incident,problem,change_request,sc_request,sc_req_item,sn_customerservice_case,customer_account,customer_contact,csm_consumer,ast_contract,service_entitlement,csm_order,csm_order_line_item");
	gr.query();

	while(gr.next()) {
		var table = gr.getValue("name"),
			style = gr.getValue("style");

		if(styles[table] == undefined)
			styles[table] = {};

		if(style && style.length) {
			var settings = style.split(";");

			for(var i = 0, length = settings.length;i < length;i++) {
				var parts = settings[i].split(":");

				if(parts.length) {
					var property = trim(parts[0]);

					if(property.length) {
						if(styles[table][property] == undefined)
							styles[table][property] = 0;

						styles[table][property]++;
					}
				}

			}
		}
	}

	return styles;
};

/*
	return { 
		itil: {'incident': 'incident', 'problem': 'problem' }
	}
*/
var getSearchGroups = function() {
	var groups = {
		itil: {},
		csm: {}
	};

	var gr = new GlideRecord("ts_group");
	gr.setWorkflow(false);
	gr.addEncodedQuery("active=true^rolesLIKEitil^ORrolesLIKEsn_customerservice_agent");
	gr.query();

	while(gr.next()) {
		var roles = gr.getValue("roles"),
			tables = gr.getValue("tables"),
			tablesArray = tables.split(","),
			isItil = (roles.indexOf("itil") != -1),
			isCsm = (roles.indexOf("sn_customerservice_agent") != -1);

		for(var i = 0, length = tablesArray.length; i < length;i++) {
			var table = trim(tablesArray[i]);

			if(isItil && groups['itil'][table] == undefined)
				groups['itil'][table] = table;

			if(isCsm && groups['csm'][table] == undefined)
				groups['csm'][table] = table;
		}
	}

	return groups;

};




var results = {
	catalogVariableTypes: getCatalogVariableTypes(),
	recordsPerPageSetting: getRecordsPerPageSetting(),
	fieldStyles: getFieldStyles(),
	searchGroups: getSearchGroups()
};

gs.print(stringify(results));






