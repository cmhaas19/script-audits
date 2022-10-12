
var CONSTANTS = {
    DELEGATED_DEV_ROLE: "a8772c23673302006cc275f557415ad4",
    SOURCE_CONTROL_ROLE: "f4b8027737b01200612747efbe41f11e",
    AES_USER_ROLE: "97f4a0c20f123300e54f3c71df767ea2"
};

var getRoleCounts = function(role) {

    var getUserCount = function(query) {
        var gr = new GlideAggregate("sys_user_has_role");
		gr.setWorkflow(false);	
		gr.addEncodedQuery(query);
		gr.groupBy("user");
		gr.query();

		return (gr.next() ? gr.getRowCount() : 0);
    };

	var days = [30, 180, 360];
    var results = {
        total: getUserCount("role=" + role + "^user.active=true")
    };

    days.forEach(function(daysAgo) {
        results[daysAgo] = getUserCount("role=" + role + "^user.active=true^user.last_login_timeISNOTEMPTY^user.last_login_time>javascript:gs.daysAgo(" + daysAgo + ")");
    });

    return results;
};

var hasBothRoles = function(roleA, roleB) {
    var gr = new GlideAggregate("sys_user_has_role");
    gr.setWorkflow(false);	
    gr.addEncodedQuery("role=" + roleA + "^user.active=true^user.last_login_timeISNOTEMPTY^user.last_login_time>javascript:gs.daysAgo(365)");
    gr.groupBy("user");
    
    var qc = gr.addJoinQuery('sys_user_has_role', 'user', 'user');
    qc.addCondition("role", "=", roleB);
    qc.addCondition("user.active", "=", true);
    qc.addNotNullQuery("user.last_login_time");
    qc.addCondition("user.last_login_time", ">", "javascript:gs.daysAgo(365)");
    
    gr.query();

    return (gr.next() ? gr.getRowCount() : 0);
};

(function(){

    var results = {
        aesRole: getRoleCounts(CONSTANTS.AES_USER_ROLE),
        delegatedDeveloperRole: getRoleCounts(CONSTANTS.DELEGATED_DEV_ROLE),
        sourceControlRole: getRoleCounts(CONSTANTS.SOURCE_CONTROL_ROLE),
        delegatedDevWithSourceControl: hasBothRoles(CONSTANTS.DELEGATED_DEV_ROLE, CONSTANTS.SOURCE_CONTROL_ROLE)
    };

    gs.print(JSON.stringify(results));

})();