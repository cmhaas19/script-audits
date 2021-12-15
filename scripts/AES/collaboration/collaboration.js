
var isStoreAppInstalled = function(scope) {
    var gr = new GlideRecord("sys_store_app");
    gr.setWorkflow(false);
    gr.addQuery("scope=" + scope);
    gr.query();

    return gr.hasNext();
};

var getInstallationStatus = function() {
    return {
        pluginInstalled: GlidePluginManager.isActive("com.glide.app_collaboration"),
        componentInstalled: isStoreAppInstalled("sn_app_collab_ui"),
        requestsInstalled: isStoreAppInstalled("sn_collab_request")
    };
};

var getCurrentLanguage = function() {
	var language = "N/A";
	try {
		language = gs.getSession().getLanguage();
	} catch(e) {}

	return language;
};

var getPermissions = function() {
    var permissions = {};

    (function(){
        var gr = new GlideRecord("sys_development_permission_set");
        gr.setWorkflow(false);
        gr.query();

        while(gr.next()) {
            permissions[gr.getUniqueValue()] = gr.getValue("name");
        };
    })();

    return permissions;
};

var getDescriptors = function() {
    var descriptors = {};

    //
    // Descriptors
    //
    (function(){
        var gr = new GlideRecord("sys_appcollab_descriptor");
        gr.setWorkflow(false);
        gr.query();

        while(gr.next()) {
            descriptors[gr.getUniqueValue()] = {
                name: gr.getValue("name"),
                description: gr.getValue("description"),
                standard: (gr.getValue("standard") == "1"),
                createdOn: gr.getValue("sys_created_on"),
                permissions: [],
                userCounts: {},
                groupCounts: {}
            };
        };
    })();

    //
    // Associated Permissions
    //
    (function(){
        var gr = new GlideRecord("sys_appcollab_permission_m2m");
        gr.setWorkflow(false);
        gr.query();

        while(gr.next()) {
            var descriptorId = gr.getValue("descriptor"),
                descriptor = descriptors[descriptorId];

            if(descriptor != undefined) {
                descriptor.permissions.push(gr.getValue("permission"));
            }            
        };
    })();

    //
    // User Counts By App
    //
    (function(){
        var gr = new GlideAggregate("sys_appcollab_user");
        gr.setWorkflow(false);
        gr.groupBy("descriptor");
        gr.groupBy("application");
        gr.addAggregate("COUNT");
        gr.query();

        while(gr.next()) {
            var applicationId = gr.application.scope.toString(), 
                descriptorId = gr.descriptor.toString(),
                count = parseInt(gr.getAggregate("COUNT"));

            var descriptor = descriptors[descriptorId];

            if(descriptor != undefined) {
                descriptor.userCounts[applicationId] = count;
            }
        };
    })();

    //
    // Group Counts By App
    //
    (function(){
        var gr = new GlideAggregate("sys_appcollab_group");
        gr.setWorkflow(false);
        gr.groupBy("descriptor");
        gr.groupBy("application");
        gr.addAggregate("COUNT");
        gr.query();

        while(gr.next()) {
            var applicationId = gr.application.scope.toString(), 
                descriptorId = gr.descriptor.toString(),
                count = parseInt(gr.getAggregate("COUNT"));

            var descriptor = descriptors[descriptorId];

            if(descriptor != undefined) {
                descriptor.groupCounts[applicationId] = count;
            }
        };
    })();

    return descriptors;
};

var getCollaborationPermissionUsage = function() {
    var permissions = {
        "70b470b8a7032010b84676a9ce7901cf": { name: "Manage Collaborators", apps: {} },
        "a3b2a40853132010b846ddeeff7b128a": { name: "Invite Collaborators", apps: {} }
    };
    
    for(var id in permissions) {
        var permission = permissions[id];
        var roles = {};

        //
        // Get roles
        //
        (function(){
            var gr = new GlideRecord("sys_scope_permission_set_role_assignment");
            gr.setWorkflow(false);
            gr.addEncodedQuery("permission_set=" + id);
            gr.setLimit(10000);
            gr.query();
    
            while(gr.next()){
                roles[gr.role.toString()] = gr.scope.scope.toString();
            }
        })();

        //
        // Get user role counts
        //
        (function(){ 
            var gr = new GlideAggregate("sys_user_has_role");
            gr.setWorkflow(false);
            gr.addQuery('state', 'active');
            gr.addQuery("role", "IN", Object.keys(roles).join(","));
            gr.addAggregate("COUNT");
            gr.groupBy("role");
            gr.query();
    
            while(gr.next()){
                var role = gr.role.toString();
                var scope = roles[role];

                permission.apps[scope] = parseInt(gr.getAggregate("COUNT"));
            }
        })();
    }

    return permissions;
};

var getCollaborationRequestCounts = function() {
    var results = {};

    var gr = new GlideAggregate("sn_collab_request_dev_collab_task");
    gr.setWorkflow(false);
    gr.addTrend("sys_created_on", 'Month');
    gr.addAggregate("COUNT");
    gr.setGroup(false);

    if(!gr.isValid())
		return results;

    gr.query();

    while(gr.next()) {
        results[gr.getValue("timeref")] = parseInt(gr.getAggregate("COUNT"));
    }

    return results;
};

(function(){

    var results = {
        currentLanguage: getCurrentLanguage(),
        installationStatus: getInstallationStatus()
    };

    if(results.installationStatus.pluginInstalled) {
        results.permissions = getPermissions();
        results.descriptors = getDescriptors();
        results.permissionUsage = getCollaborationPermissionUsage();
        results.requestCounts = getCollaborationRequestCounts();
    }

    gs.print(JSON.stringify(results));

})();