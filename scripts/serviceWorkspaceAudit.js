
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

var getFormFieldTypes = function() {

	var returnValue = {
		itsm: [],
		csm: []
	};

	var dictionary = (function() {
		var dictionaryEntries = {};

		var gr = new GlideRecord("sys_dictionary");
		gr.setWorkflow(false);
		gr.addEncodedQuery("nameINtask,incident,problem,change_request,sc_request,sc_req_item,sn_customerservice_case,customer_account,customer_contact,csm_consumer,ast_contract,service_entitlement,csm_order,csm_order_line_item");
		gr.query();

		while(gr.next()) {
			var element = gr.getValue("element");

			dictionaryEntries[element] = {
				"name": gr.getValue("name"),
				"element": element,
				"glideType": gr.getValue("internal_type"),
				"reference": gr.getValue("reference")
			};
		}
		
		return {
			findElementByName: function(elementName) {
				return dictionaryEntries[elementName];
			}
		};

	})();

	var fieldResults = (function(){
		var map = {};

		return {
			addElement: function(dictionaryElement) {
				if(dictionaryElement && map[dictionaryElement.glideType] == undefined) {
					map[dictionaryElement.glideType] = dictionaryElement;
				}
			},

			getElements: function() {
				var elements = [];

				for(var prop in map){
					elements.push(prop);
				}

				return elements;
			},

			reset: function() {
				map = {}
			}
		};

	})();

	returnValue.itsm = (function(){
		fieldResults.reset();

		var gr = new GlideRecord("sys_ui_element");
		gr.setWorkflow(false);
		gr.addEncodedQuery("sys_ui_section.nameINincident,problem,change_request,sc_request,sc_req_item^sys_ui_section.view=Default view");
		gr.query();

		while(gr.next()) {
			var element = dictionary.findElementByName(gr.getValue("element"));
			fieldResults.addElement(element);
		}

		return fieldResults.getElements();

	})();

	if(pm.isRegistered("com.sn_customerservice")){
		fieldResults.reset();

		returnValue.csm = (function(){
			var gr = new GlideRecord("sys_ui_element");
			gr.setWorkflow(false);
			gr.addEncodedQuery("sys_ui_section.nameINsn_customerservice_case,customer_account,customer_contact,csm_consumer,ast_contract,service_entitlement,csm_order,csm_order_line_item^sys_ui_section.view.name=Case");
			gr.query();

			while(gr.next()) {
				var element = dictionary.findElementByName(gr.getValue("element"));
				fieldResults.addElement(element);
			}

			return fieldResults.getElements();

		})();
	}

	return returnValue;
	
};

var getUserPreferences = function() {

	var returnValue = {
		tabbedFormsDefaultValue: false,
		totalUsers: 0,
		tabbedForms: 0
	};

	//
	// Grab the default value for tabbed.forms
	//
	var gr = new GlideRecord("sys_user_preference");
	gr.setWorkflow(false);
	gr.addEncodedQuery("name=tabbed.forms^user=NULL");
	gr.query();

	if(!gr.next())
		return returnValue;

	returnValue.tabbedFormsDefaultValue = (gr.getValue("value") == "true");

	//
	// Query for all active itil or itil_admin users who have logged in within the last 30 days
	//
	var users = new GlideRecord("sys_user_has_role");
	users.setWorkflow(false);
	users.addEncodedQuery("role=282bf1fac6112285017366cb5f867469^ORrole=28322f3cc611228500e20459e33eef34^user.active=true^user.last_login_timeISNOTEMPTY^user.last_login_time>javascript:gs.dateGenerate('2017-07-01','00:00:00')");
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
	preference.addAggregate('COUNT');
	preference.addEncodedQuery("name=tabbed.forms^value=" + !returnValue.tabbedFormsDefaultValue + "^userIN" + userIds.join(","));
	preference.query();

	var preferenceCount = 0;

	if(preference.next())
		preferenceCount = preference.getAggregate('COUNT');

	//
	// If the default value of tabbed forms is false, then the number of users with tabbedForms true should 
	// equal the result of the preference query.
	// If the default value is true, then the number of users with tabbedForms should be total users
	// minus the result of the preference query
	//
	if(returnValue.tabbedFormsDefaultValue == false) {
		returnValue.tabbedForms = preferenceCount;
	} else {
		returnValue.tabbedForms = returnValue.totalUsers - preferenceCount;
	}

	return returnValue;
};


var results = {
	formFieldTypes: getFormFieldTypes(),
	preferences: getUserPreferences()
};

gs.print(stringify(results));






