

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

			parsedUrl.path = pathName;

			for(var i = 0;i < paramCount;i++) {
				var param = params[i];

				if(param.substring(0, 1) == "?")
					param = param.substring(1);

				if(param.indexOf("sysparm_query") != -1) {
					parsedUrl.query = decodeURIComponent(param.replace(/sysparm_query=/g, ""));
					return parsedUrl;
				}
			}

			return parsedUrl;
		}
	}

	return null;
};


var getBookmarks = function() {

	var results = {
		totalFulfillers: 0,
		totalListBookmarks: 0,
		totalConditions: 0,
		averageConditions: 0
	};

	var totalConditions = 0;

	results.totalFulfillers = (function() {
		var gr = new GlideAggregate("sys_user_has_role");
		gr.setWorkflow(false);	
		gr.addEncodedQuery("role.name!=snc_internal^role.name!=snc_external^role.name!=approver_user^user.active=true^user.last_login_time>javascript:gs.dateGenerate('2018-02-01','00:00:00')");
		gr.groupBy("user");
		gr.query();

		return (gr.next() ? gr.getRowCount() : 0);

	})();

	var gr = new GlideRecord("sys_ui_bookmark");
	gr.setWorkflow(false);
	gr.addEncodedQuery("moduleISEMPTY^urlLIKE_list.do");

	var users = gr.addJoinQuery("sys_user_has_role", "user", "user");
	users.addCondition("role.name", "NOT IN", "approval_user,snc_internal,snc_external");
	users.addCondition("user.active", "=", "true");
	users.addCondition("user.last_login_time", ">", "javascript:gs.dateGenerate('2018-02-01','00:00:00')");

	gr.query();

	while(gr.next()){
		var url = gr.getValue("url"),
			parsedUrl = parseUrl(url);

		if(parsedUrl != null) {
			results.totalListBookmarks++;

			if(parsedUrl.query && parsedUrl.query.length) {
				var conditions = parsedUrl.query.split("^").length;
				results.totalConditions += conditions;
			}
			
		}
	}

	results.averageConditions = (results.totalConditions / results.totalListBookmarks);

	return results;
};


var results = {
	bookmarks: getBookmarks()
};

gs.print(JSON.stringify(results));