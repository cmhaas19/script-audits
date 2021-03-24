

var parseUrl = function(url) {
	var parsedUrl = {};

	if(!url || url.length == 0)
		return null;

	if(url.substring(0, 1) != "/")
		url = "/" + url;

	if(url.substring(0, 4) != "http")
		url = "https://domain.com" + url;

	var match = url.match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/);

	if(match) {
		var pathName = match[5],
			search = match[6];

		if(pathName.length && pathName.indexOf("_list.do") != -1 ) {
			if(pathName.substring(0, 1) == "/")
				pathName = pathName.substring(1);

			return pathName;
		}
	}

	return null;
};


/*
 *
 * Returns distinct list of itil users sysId's
 *
*/
var itilUsers = (function(){

	var users = new GlideAggregate("sys_user_has_role");
	users.setWorkflow(false);
	users.addEncodedQuery("user.active=true^role.name=itil");
	users.addAggregate("COUNT");
	users.groupBy("user");
	users.setLimit(1000);
	users.query();

	var userIds = [];

	while(users.next()){
		userIds.push(users.getValue("user"));
	}

	return userIds;

})();

var getBookmarks = function(query) {
	var gr = new GlideRecord("sys_ui_bookmark");
	gr.setWorkflow(false);
	gr.addEncodedQuery(query);
	gr.query();

	var results = {
		totalUsers: itilUsers.length,
		bookmarks: {}
	};

	while(gr.next()){
		var url = gr.getValue("url"),
			userId = gr.getValue("user"),
			path = parseUrl(url);

		if(path != null) {

			if(results.bookmarks[path] == undefined)
				results.bookmarks[path] = { users: {} };

			if(results.bookmarks[path].users[userId] == undefined)
				results.bookmarks[path].users[userId] = true;
		}
	}

	for(var prop in results.bookmarks) {
		var bookmark = results.bookmarks[prop];

		// Get the total user count
		bookmark.totalUsers = Object.keys(bookmark.users).length;

		// Remove the users property as we don't need that data
		delete bookmark.users;
	}

	return results;
};


var userIds = itilUsers.join(",");

var returnValue = {
	bookmarks: getBookmarks("urlLIKE_list.do^userIN" + userIds),
	customBookmarks: getBookmarks("moduleISEMPTY^urlLIKE_list.do^userIN" + userIds)
};

gs.print(JSON.stringify(returnValue));





