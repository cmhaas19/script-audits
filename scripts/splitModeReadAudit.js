

var returnValue = {
	listV3PluginEnabled: false,
	listV3PropertyEnabled: false,
	listV3Enabled: false,
	listControl: [],
	bookmarks: [],
	templateCriteria: {}
};

returnValue.listV3PluginEnabled = pm.isRegistered("com.glide.ui.list_v3");
returnValue.listV3PropertyEnabled = gs.getProperty("glide.ui.list_v3.enable", false);
returnValue.listV3Enabled = (returnValue.listV3PluginEnabled && returnValue.listV3PropertyEnabled);

if(JSON && JSON.stringify){

	//
	// Returns object representation of template criteria counts
	// Ex: { 1: 24, 2: 9, 3: }
	//
	returnValue.templateCriteria = (function(){
		var templateData = {
			templates: 0,
			criteria: {}
		};

		var gr = new GlideRecord("sys_template");
		gr.setWorkflow(false);
		gr.addEncodedQuery("table=incident^active=true");
		gr.query();

		templateData.templates = gr.getRowCount();

		while(gr.next()){
			var template = gr.getValue("template"),
				criteriaCount = 0;

			gs.print(template);

			if(template && template.length) {
				var items = template.split("^");

				for(var i = 0, length = items.length;i < length; i++) {
					if(items[i].indexOf("=") != -1)
						criteriaCount++;
				}

				var key = "0";
				if(criteriaCount <= 5)
					key = criteriaCount.toString();
				else if(criteriaCount > 5)
					key = "5+";

				if(templateData.criteria[key] == undefined)
					templateData.criteria[key] = 0;

				templateData.criteria[key]++;
			}
		}

		return templateData;

	})();

	if(returnValue.listV3Enabled) {

		//
		// Get a list of tables where split view is enabled by default
		//
		returnValue.listControl = (function(){
			var map = {};

			var gr = new GlideRecord("sys_ui_list_control");
			gr.setWorkflow(false);
			gr.addEncodedQuery("mode=split");
			gr.query();

			while(gr.next()) {
				var table = gr.getValue("name");

				if(map[table] == undefined) {			
					map[table] = true;
				}
			}

			return Object.getOwnPropertyNames(map);

		})();

		//
		// Get table & no. of itil/itil_admin users that have a bookmark with split mode enabled
		//
		returnValue.bookmarks = (function(){

			var parseUrl = function(url) {
				var match = url.match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/);
			    return match && {
			        url: url,
			        protocol: match[1],
			        host: match[2],
			        hostname: match[3],
			        port: match[4],
			        pathname: match[5],
			        search: match[6],
			        hash: match[7]
			    };
			};	

			//
			// Query for all active itil or itil_admin users
			//
			var users = new GlideRecord("sys_user_has_role");
			users.setWorkflow(false);
			users.addEncodedQuery("role=282bf1fac6112285017366cb5f867469^ORrole=28322f3cc611228500e20459e33eef34^user.active=true");
			users.setLimit(1000);
			users.query();

			var map = {},
				userMap = {},
				userIds = [],
				tables = [];

			while(users.next()){
				var id = users.getValue("user");

				if(userMap[id] == undefined){
					userMap[id] = id;
				}
			}

			userIds = Object.getOwnPropertyNames(userMap);

			var gr = new GlideRecord("sys_ui_bookmark");
			gr.setWorkflow(false);
			gr.addEncodedQuery("urlLIKEsysparm_list_mode=split^userIN" + userIds.join(","));
			gr.query();

			while(gr.next()) {
				var url = gr.getValue("url"),
					parsedUrl = parseUrl("https://domain.com" + url),
					userId = gr.getValue("user");

				if(parsedUrl && parsedUrl.pathname && parsedUrl.pathname.length) {
					if(map[parsedUrl.pathname] == undefined)
						map[parsedUrl.pathname] = {};

					// Ex: map["incident_list.do"] = {"1231234123": true, "089077896": true};
					if(map[parsedUrl.pathname][userId] == undefined)
						map[parsedUrl.pathname][userId] = true;
				}
			}

			for(var prop in map) {
				var count = 0;

				for(var user in map[prop]){
					count++;
				}

				tables.push({name: prop, count: count });
			}


			return {
				totalUsers: userIds.length,
				tables: tables
			};


		})();

	}

	gs.print(JSON.stringify(returnValue));
}





