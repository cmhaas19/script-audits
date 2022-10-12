
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


var returnValue = {};

var getActions = function(query) {
	var results = [];

	var gr = new GlideRecord("sys_ui_action");
	gr.setWorkflow(false);
	gr.addEncodedQuery(query);
	gr.query();

	while(gr.next()){
		results.push({
			name: gr.getValue("name"),
			table: gr.getValue("table"),
			client: gr.getValue("client"),
			onclick: gr.getValue("onclick"),
			script: gr.getValue("script")
		});
	}

	return results;
};

var getPolicies = function(query) {
	var results = [];

	var gr = new GlideRecord("sys_ui_policy");
	gr.setWorkflow(false);
	gr.addEncodedQuery(query);
	gr.query();

	while(gr.next()){
		results.push({
			shortDescription: gr.getValue("short_description"),
			table: gr.getValue("table"),
			scriptTrue: gr.getValue("script_true"),
			scriptFalse: gr.getValue("script_false")
		});
	}

	return results;
};

returnValue.itsm = {
	actions: getActions("tableINtask,incident,problem,change_request,sc_request,sc_req_item^active=true^form_action=true"),
	policies: getPolicies("run_scripts=true^active=true^tableINtask,incident,problem,change_request,sc_request,sc_req_item")
};

if(pm.isRegistered("com.sn_customerservice")) {
	returnValue.csm = {
		actions: getActions("tableINsn_customerservice_case,customer_account,customer_contact,csm_consumer,ast_contract,service_entitlement,csm_order,csm_order_line_item^active=true^form_action=true"),
		policies: getPolicies("run_scripts=true^active=true^tableINsn_customerservice_case,customer_account,customer_contact,csm_consumer,ast_contract,service_entitlement,csm_order,csm_order_line_item")
	};
}

gs.print(stringify(returnValue));






