
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


/*
 Returns count of templates on the incident table plus the number of templates
 where each field is set.

 "templateCriteria":{  
      "templates":8,
      "averageCriteria":4.625,
      "maxCriteria":8,
      "criteria":{  
         "urgency":4,
         "comments":2,
         "category":4,
         "impact":3,
         "short_description":4,
         "active":3,
         "contact_type":2,
         "assignment_group":3,
         "cmdb_ci":1,
         "opened_by":1,
         "state":2
      } 
*/
returnValue.templateCriteria = (function() {

	var templateData = {
		templates: 0,
		averageCriteria: 0,
		maxCriteria: 0,
		criteria: {}
	};

	var criteriaCount = 0;

	var gr = new GlideRecord("sys_template");
	gr.setWorkflow(false);
	gr.addEncodedQuery("table=incident^active=true");
	gr.query();

	templateData.templates = gr.getRowCount();

	while(gr._next()){
		var template = gr.getValue("template");

		if(template && template.length) {
			var items = template.split("^"),
				itemCount = items.length;

			criteriaCount += itemCount;

			if(itemCount > templateData.maxCriteria)
				templateData.maxCriteria = itemCount;

			for(var i = 0, length = items.length;i < length; i++) {
				if(items[i].indexOf("=") != -1) {
					var criteria = items[i].split("=");
					if(criteria.length > 0) {
						var field = criteria[0];

						if(templateData.criteria[field] == undefined)
							templateData.criteria[field] = 0;

						templateData.criteria[field]++;
					}					
				}
			}
		}
	}

	if(templateData.templates > 0)
		templateData.averageCriteria = (criteriaCount / templateData.templates);

	return templateData;

})();



/*
	Get bookmarks for itil users, grouped by page name and parameter counts:

	{
		"totalUsers":26,
		"bookmarks": {
			"incident_list.do":{  
	            "totalBookmarks":6,
	            "parameters":{  
	               "active=true":6,
	               "EQ":5,
	               "assigned_toISEMPTY":2,
	               "assignment_groupDYNAMICd6435e965f510100a9ad2572f2b47744":1
	            }
         }
		}
	}
*/
returnValue.bookmarks = (function() {

	var parseUrl = function(url) {
		var parsedUrl = {};

		if(!url || url.length == 0)
			return null;

		if(url.substring(0, 1) != "/")
			url = "/" + url;

		if(url.substring(0, 3) != "http")
			url = "https://domain.com" + url;

		var match = url.match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/);

		if(match) {
			var pathName = match[5],
				search = match[6];

			if(pathName.length && pathName.indexOf("_list.do") != -1 && search.length) {
				if(pathName.substring(0, 1) == "/")
					pathName = pathName.substring(1);

				var params = search.split("&"),
					paramCount = params.length;

				for(var i = 0;i < paramCount;i++) {
					var param = params[i];

					if(param.substring(0, 1) == "?")
						param = param.substring(1);

					if(param.indexOf("sysparm_query") != -1) {
						return {
							path: pathName,
							query: decodeURIComponent(param.replace(/sysparm_query=/g, ""))
						};
					}
				}
			}
		}

		return null;
	};


	var users = new GlideRecord("sys_user_has_role");
	users.setWorkflow(false);
	users.addEncodedQuery("role=282bf1fac6112285017366cb5f867469^ORrole=28322f3cc611228500e20459e33eef34^user.active=true");
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

	var gr = new GlideRecord("sys_ui_bookmark");
	gr.setWorkflow(false);
	gr.addEncodedQuery("urlLIKE_list.do^urlLIKEsysparm_query^userIN" + userIds.join(","));
	gr.query();

	var results = {
		totalUsers: gr.getRowCount(),
		bookmarks: {}
	};

	while(gr.next()){
		var url = gr.getValue("url"),
			parsedUrl = parseUrl(url);

		if(parsedUrl != null) {
			var path = parsedUrl.path,
				query = parsedUrl.query,
				params = query.split("^");

			if(results.bookmarks[path] == undefined)
				results.bookmarks[path] = { totalBookmarks: 0, parameters: {} };

			results.bookmarks[path].totalBookmarks++;

			for(var i = 0, length = params.length;i < length;i++){
				var param = params[i];

				if(results.bookmarks[path].parameters[param] == undefined)
					results.bookmarks[path].parameters[param] = 0;

				results.bookmarks[path].parameters[param]++;
			}
		}
	}

	return results;

})();

gs.print(stringify(returnValue));





