
var PERMISSION_SETS = {
    "043a115e679112006cc2956c33415a36":{
       "name":"All Metadata",
       "type":"all_metadata",
       "id": 0
    },
    "15cd4605530203001f2bddeeff7b1225":{
       "name":"Upgrade App",
       "type":"deployment",
       "id": 1
    },
    "1a98488373232300e6da35880ff6a757":{
       "name":"Manage Update Set",
       "type":"deployment",
       "id": 2
    },
    "23a2a5c077213010612c1b1ad9106133":{
       "name":"Process Automation Designer",
       "type":"permission_restricted",
       "id": 3
    },
    "323a115e679112006cc2956c33415a52":{
       "name":"Script Edit",
       "type":"script_field",
       "id": 4
    },
    "3e5263700b0312005a33061437673ae9":{
       "name":"Integrations",
       "type":"permission_restricted",
       "id": 5
    },
    "3e59c155ff1320102b341888253bf154":{
       "name":"Submit for Deployment",
       "type":"deployment",
       "id": 6
    },
    "4bf3249b671112006cc275f557415a4f":{
       "name":"Reporting",
       "type":"permission_restricted",
       "id": 7
    },
    "515a115e679112006cc2956c33415a78":{
       "name":"Security Management",
       "type":"security_management",
       "id": 8
    },
    "54cfeaf95b310300ebacefe5f0f91a07":{
       "name":"Publish To Update Set",
       "type":"deployment",
       "id": 9
    },
    "57f39a28c3132010a9f5e548fa40ddeb":{
       "name":"Delete Application",
       "type":"application_management",
       "id": 10
    },
    "5f790cb45b320300ebacefe5f0f91a50":{
       "name":"Publish To App Repo",
       "type":"deployment",
       "id": 11
    },
    "6487d716c3523010d4437f9ec840dd12":{
       "name":"Decision Tables",
       "type":"permission_restricted",
       "id": 12
    },
    "70b470b8a7032010b84676a9ce7901cf":{
       "name":"Manage Collaborators",
       "type":"application_management",
       "id": 13
    },
    "78ba76350f101010e70a4abec4767eb3":{
       "name":"Mobile Builders",
       "type":"permission_restricted",
       "id": 14
    },
    "7d9e4c19ff722010bb24108e793bf121":{
       "name":"UI Builder",
       "type":"permission_restricted",
       "id": 15
    },
    "7f0fc262c3221200c9c85cbc5bba8f28":{
       "name":"Workflow",
       "type":"permission_restricted",
       "id": 16
    },
    "82249a90531320100f29ddeeff7b12e1":{
       "name":"Source Control",
       "type":"application_management",
       "id": 17
    },
    "a3b2a40853132010b846ddeeff7b128a":{
       "name":"Invite Collaborators",
       "type":"application_management",
       "id": 18
    },
    "bb04249b671112006cc275f557415a94":{
       "name":"Service Catalog",
       "type":"permission_restricted",
       "id": 19
    },
    "d3d80056c3331200e6da174292d3aee2":{
       "name":"Service Portal",
       "type":"permission_restricted",
       "id": 20
    },
    "d3ef33c067200300c4098c7942415a50":{
       "name":"Flow Designer",
       "type":"permission_restricted",
       "id": 21
    },
    "dbc314565b320300ebacefe5f0f91ad7":{
       "name":"Publish To App Store",
       "type":"deployment",
       "id": 22
    },
    "ec04249b671112006cc275f557415a60":{
       "name":"Tables & Forms",
       "type":"permission_restricted",
       "id": 23
    }
 };

var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

    if(companyCode == undefined || companyCode == null || companyCode.length == 0)
        return null;
        
    return companyCode;
};

var getDelegatedDevelopmentStats = function() {    
    var results = {};
    
    if(!GlidePluginManager.isActive('com.glide.delegated_development'))
        return results;

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

            s.permissionSets[scopeName].push({ 
                'id': gr.getValue("permission_set"), 
                'name': permissionName,
                'type': gr.permission_set.type.toString(),
                'role': roleName,
                'scope': scopeName
             });
        }

    })(scopes);

    //
    // Get count of roles/users
    //
    (function(s, r){

        var ga = new GlideRecord("sys_user_has_role");
        ga.setWorkFlow(false);
        ga.addQuery('state', 'active');
        ga.addQuery('role', 'IN', s.getRoles());
        ga.query();
        
        while(ga.next()){
            var role = ga.getValue('role');
            var user = ga.getValue('user');
            var permissionSet = s.findRole(role);

            if(permissionSet) {
                if(r[permissionSet.scope] == undefined)
                    r[permissionSet.scope] = {};

                if(r[permissionSet.scope][user] == undefined)
                    r[permissionSet.scope][user] = {};

                r[permissionSet.scope][user][permissionSet.id] = 1;
            }
        }

    })(scopes, results);

    //
    // Now, let's clean up the data
    //
    var cleanResults = {};

    for(var scopeName in results) {
        var scope = results[scopeName];
        var userIndex = 0;

        for(var userId in scope) {
            userIndex++;
            var user = scope[userId];
            var shortName = "u" + userIndex.toString();            

            var allMetadataExists = (user["043a115e679112006cc2956c33415a36"] != undefined);

            //
            // Re-build the results
            //
            for(var permissionId in user) {
                var permission = PERMISSION_SETS[permissionId];

                if(permission) {
                    if(cleanResults[scopeName] == undefined)
                        cleanResults[scopeName] = {};

                    if(cleanResults[scopeName][shortName] == undefined)
                        cleanResults[scopeName][shortName] = {};

                    if(permission.type == "permission_restricted" && allMetadataExists) {
                        cleanResults[scopeName][shortName]["0"] = 1;
                    } else {
                        cleanResults[scopeName][shortName][permission.id] = 1;
                    }
                }
            }
        }
    }

    return cleanResults;
};

(function(){

	var auditResults = {
        companyCode: getCompanyCode(),
        delegatedDevActive: GlidePluginManager.isActive('com.glide.delegated_development'),
        delegatedDeveloperStats: getDelegatedDevelopmentStats()
	};

	gs.print(JSON.stringify(auditResults));

})();
