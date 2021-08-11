
var getCompanyCode = function() {
	var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return null;

	return companyCode;
};

var getCustomRoles = function(){
    var roles = (function(){
        var gr = new GlideRecord("sys_user_role");
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_scope.scopeSTARTSWITHx_" + getCompanyCode());
        gr.query();

        var results = {};

        while(gr.next()) {
            var roleName = gr.getValue("name");

            results[roleName] = { 
                description: gr.getValue("description"),
                createdOn: gr.getValue("sys_created_on"),
                scope: gr.sys_scope.scope.toString(),
                users: 0
            };
        }

        return results;
    })();

    //
    // Get the count of users who have the custom roles
    //
    (function(){
        var gr = new GlideAggregate("sys_user_has_role");
        gr.addAggregate("COUNT");
        gr.setWorkflow(false);
        gr.groupBy("role")        
        gr.addEncodedQuery("role.nameIN" + Object.keys(roles).join(","));
        gr.query();

        while(gr.next()){
            var roleName = gr.role.name.toString(),
                role = roles[roleName];

            role.users = parseInt(gr.getAggregate("COUNT"));
        }
    })();

    return roles;
};


(function(){

	if(getCompanyCode() == null)
		return {};

	var auditResults = {
		customRoles: getCustomRoles()
	};

	gs.print(JSON.stringify(auditResults));

})();