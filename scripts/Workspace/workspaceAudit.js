
var getWorkspaceData = function() {

    var workspaces = (function(){
        var data = {};
        var gr = new GlideRecord("sys_aw_master_config");

        if(!gr.isValid())
            return data;

        gr.setWorkflow(false);
        gr.setLimit(45);
        gr.addQuery('sys_scope.scope', 'NOT LIKE', 'sn_%');
        gr.query();

        while(gr.next()) {
            if(!gr.isValidField("navigation_type"))
                return data;

            var id = gr.getUniqueValue();

            data[id] = {
                name: gr.getValue("name"),
                createdOn: gr.getValue("sys_created_on"),
                navigationType: gr.getValue("navigation_type"),
                notifications: gr.getValue("notifications_enabled"),
                search: gr.getValue("search_enabled"),
                userPrefs: gr.getValue("user_preference_controls_enabled"),
                url: gr.getValue("workspace_url"),
                color: gr.getValue("brand_color"),
                primaryColor: gr.getValue("primary_color"),
                logo: gr.getValue("workspace_logo"),
                scope: gr.sys_scope.scope.toString(),
                modules: [],
                lists: [],
                newRecordMenu: []               
            };
        }
        
        return data;

    })();

    if(workspaces == null || workspaces == undefined || !Object.keys(workspaces).length)
        return;

    //
    // Fetch modules
    //
    (function(){
        var gr = new GlideRecord("sys_aw_module");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.query();

        while(gr.next()) {
            var workspaceId = gr.getValue("workspace_config");
            var workspace = workspaces[workspaceId];

            if(workspace == undefined)
                continue;

            workspace.modules.push({
                id: gr.getValue("id"),
                label: gr.getValue("label"),
                icon: gr.getValue("icon")
            });
        }

    })();

    //
    // Fetch lists
    //
    (function(){
        var gr = new GlideRecord("sys_aw_list");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.query();

        while(gr.next()) {
            var workspaceId = gr.getValue("workspace");
            var workspace = workspaces[workspaceId];

            if(workspace == undefined)
                continue;

            workspace.lists.push({
                table: gr.getValue("table"),
                title: gr.getValue("title"),
                category: gr.category.getDisplayValue()
            });
        }

    })();

    //
    // Fetch 'New Record Menu'
    //
    (function(){
        var gr = new GlideRecord("sys_aw_new_menu_item");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.query();

        while(gr.next()) {
            var workspaceId = gr.getValue("workspace_config");
            var workspace = workspaces[workspaceId];

            if(workspace == undefined)
                continue;

            workspace.newRecordMenu.push({
                table: gr.getValue("table")
            });
        }

    })();

    return workspaces;
    
};

(function(){

	gs.print(JSON.stringify(getWorkspaceData()));

})();