
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

    if(companyCode == undefined || companyCode == null || companyCode.length == 0)
        return null;
        
    return companyCode;
};

var getCustomApps = function() {

	var getApps = function(query) {

		var localApps = (function(){
			var gr = new GlideAggregate("sys_app");
			gr.setWorkflow(false);
			gr.addEncodedQuery(query);
			gr.addAggregate("COUNT");
			gr.query();

			return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
		})();

		var storeApps = (function(){
			var gr = new GlideAggregate("sys_store_app");
			gr.setWorkflow(false);
			gr.addEncodedQuery(query);
			gr.addAggregate("COUNT");
			gr.query();

			return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
		})();

		return (localApps + storeApps);
	};

	var companyCode = getCompanyCode();

	if(companyCode == null)
		return {};

	return {
		scopedCount: getApps("scopeSTARTSWITHx_" + companyCode + "^active=true"),
		scopedCountLastYear: getApps("scopeSTARTSWITHx_" + companyCode + "^active=true^sys_created_onRELATIVEGE@year@ago@1"),
		globalCount: getApps("scope=global^vendor_prefix=NULL^active=true"),
		globalCountLastYear: getApps("scope=global^vendor_prefix=NULL^active=true^sys_created_onRELATIVEGE@year@ago@1")
	};

};

var getDelegatedDevelopmentStats = function() {    
    
    if(!GlidePluginManager.isActive('com.glide.delegated_development'))
        return {};

    var scopes = {
        permissionSets: {},
        getRoles: function(){
            var roles = [];
            for(var p in this.permissionSets){
                for(var i = 0; i < this.permissionSets[p].length;i++)
                    roles.push(this.permissionSets[p][i].role);
            }
            return roles;
        },
        findRole: function(id) {
            for(var p in this.permissionSets){
                for(var i = 0; i < this.permissionSets[p].length;i++){
                    var role = this.permissionSets[p][i].role;
                    if(role == id)
                        return this.permissionSets[p][i];
                }
            }
        }
    };

    //
    // Get all the roles/permissions/scopes
    //
    (function(s) {
        var gr = new GlideRecord('sys_scope_permission_set_role_assignment');
        gr.setWorkflow(false);
        gr.addNotNullQuery('role');
        gr.query();

        while(gr.next()){
            var scopeName = gr.scope.scope,
                roleName = gr.getValue('role'),
                permissionName = gr.permission_set.getDisplayValue();            

            if(s.permissionSets[scopeName] == undefined)
                s.permissionSets[scopeName] = [];

            s.permissionSets[scopeName].push({ 'permission': permissionName, 'role': roleName });
        }

    })(scopes);

    //
    // Get count of roles/users
    //
    (function(s){
        var ga = new GlideAggregate("sys_user_has_role");
        ga.setWorkFlow(false);
        ga.addAggregate('COUNT');
        ga.addQuery('state', 'active');
        ga.addQuery('role', 'IN', s.getRoles());
        ga.groupBy('role');
        ga.query();
        
        while(ga.next()){
            var role = ga.getValue('role'),
                count = parseInt(ga.getAggregate('COUNT'));

            var permissionSet = s.findRole(role);

            if(permissionSet)
                permissionSet.userCount = count;

        }

    })(scopes);

    //
    // Get count of roles/groups
    //
    (function(s){
        var ga = new GlideAggregate("sys_group_has_role");
        ga.setWorkFlow(false);
        ga.addAggregate('COUNT');
        ga.addQuery('role', 'IN', s.getRoles());
        ga.groupBy('role');
        ga.query();
        
        while(ga.next()){
            var role = ga.getValue('role'),
                count = parseInt(ga.getAggregate('COUNT'));

            var permissionSet = s.findRole(role);

            if(permissionSet)
                permissionSet.groupCount = count;
        }

    })(scopes);

    return scopes.permissionSets;
    
};

var getRecords = function(table, query){
    var records = [];

    var gr = new GlideRecord(table);

    if(!gr.isValid())
        return records;

    gr.setWorkflow(false);
    gr.setLimit(10000);
    
    if(query)
        gr.addEncodedQuery(query);

    gr.query();

    var util = new GlideRecordUtil();
    var fieldList = [];

    while(gr.next()){
        var record = { scope: gr.sys_app.scope.toString() };

        if(fieldList.length == 0)
            fieldList = util.getFields(gr);

        for(var i = 0, fields = fieldList.length;i < fields;i++){
            var fieldName = fieldList[i];
            record[fieldName] = gr.getValue(fieldName);
        }

        records.push(record);
    }

    return records;

};

var getSourceControlConfigs = function() {

    return {
        repoConfigs: getRecords('sys_repo_config'),
        repoBranches: getRecords('sys_repo_branch')
    };

};

var getAppDetails = function(){
    var companyCode = getCompanyCode();

    if(companyCode == null)
        return;

    return {
        appRecords: getRecords('sys_app', "scopeSTARTSWITHx_" + companyCode + "^active=true"),
        storeAppRecords: getRecords('sys_store_app', "scopeSTARTSWITHx_" + companyCode + "^active=true"),
        appArtifacts: getAppArtifacts()
    };
};

var getAppArtifacts = function() {
	var artifacts = {};

	var gr = new GlideAggregate("sys_metadata");
	gr.setWorkflow(false);
    gr.addAggregate("COUNT");
    gr.groupBy("sys_scope");
    gr.groupBy("sys_class_name");
    
    var scopes = gr.addJoinQuery("sys_app", "sys_scope", "sys_id");
	scopes.addCondition("scope", "STARTSWITH", "x_" + getCompanyCode());
	scopes.addCondition("active", "=", "true");

	gr.query();

	while(gr.next()){
		var count = parseInt(gr.getAggregate("COUNT")),
			scope = gr.sys_scope.scope.toString(),
			className = gr.sys_class_name.toString();

		if(artifacts[scope] == undefined)
			artifacts[scope] = {};

		if(artifacts[scope][className] == undefined)
			artifacts[scope][className] = 0;

		artifacts[scope][className] += count;
	}

	return artifacts;

};

(function(){

	var auditResults = {
        companyCode: getCompanyCode(),
        buildTag: gs.getProperty("glide.buildtag"),
        delegatedDevActive: GlidePluginManager.isActive('com.glide.delegated_development'),
        appStats: getCustomApps(),
        appDetails: getAppDetails(),
        delegatedDeveloperStats: getDelegatedDevelopmentStats(),
        sourceControlRecords: getSourceControlConfigs()
	};

	gs.print(JSON.stringify(auditResults));

})();