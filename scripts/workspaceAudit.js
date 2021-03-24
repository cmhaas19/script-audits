
var getWorkspaceData = function() {

    var workspaces = (function(){
        var data = {};
        var gr = new GlideRecord("sys_aw_master_config");

        if(!gr.isValid())
            return data;

        gr.setWorkflow(false);
        gr.setLimit(5000);
        gr.query();

        while(gr.next()) {
            if(!gr.isValidField("navigation_type"))
                return data;

            var id = gr.getUniqueValue();

            data[id] = {
                id: id,
                name: gr.getValue("name"),
                description: gr.getValue("description"),
                createdOn: gr.getValue("sys_created_on"),
                navigationType: gr.getValue("navigation_type"),
                notificationsEnabled: gr.getValue("notifications_enabled"),
                searchEnabled: gr.getValue("search_enabled"),
                userPreferencesEnabled: gr.getValue("user_preference_controls_enabled"),
                workspaceUrl: gr.getValue("workspace_url"),
                brandColor: gr.getValue("brand_color"),
                primaryColor: gr.getValue("primary_color"),
                compiledPageRegistry: gr.getValue("compiled_page_registry"),
                modules: {},
                lists: {},
                landingPages: {}
            };
        }
        
        return data;

    })();

    if(workspaces == null || workspaces == undefined || !Object.keys(workspaces).length)
        return;

    // Fetch modules
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

            var moduleId = gr.getUniqueValue();

            workspace.modules[moduleId] = {
                id: gr.getValue("id"),
                label: gr.getValue("label"),
                order: gr.getValue("order"),
                icon: gr.getValue("icon"),
                type: gr.getValue("type")
            };
        }

    })();

    // Fetch lists
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

            var listId = gr.getUniqueValue();

            workspace.lists[listId] = {
                table: gr.getValue("table"),
                title: gr.getValue("title"),
                category: gr.category.getDisplayValue(),
                active: gr.getValue("active")
            };
        }

    })();

    // Fetch landing pages
    (function(){

        var getLandingPagePlaceholderSysId = function(compiledPageRegistryID){
            var gr = new GlideRecord("sys_ux_custom_content_root_elem");

            if(!gr.isValid())
                return null;

            gr.addQuery("applicable_page", compiledPageRegistryID);
            gr.setWorkflow(false);
            gr.query();

            if (!gr.hasNext())
                return null;

            var list = [];
            while(gr.next())
                list.push(gr.getUniqueValue());

            var gr1 = new GlideRecord("sys_ux_content_placeholder_elem");
            gr1.addQuery("parent", "IN", list.join(","));
            gr1.addQuery("name", "Landing Page Placeholder");
            gr1.orderByDesc("sys_updated_on");
            gr1.setWorkflow(false);
            gr1.query();
    
            return (gr1.next() ? gr1.getUniqueValue() : null);
        };

        for(var workspaceId in workspaces) {
            var gr = new GlideRecord("sys_ux_custom_content_root_elem");

            if(!gr.isValid())
                return;

            var workspace = workspaces[workspaceId];
            var placeholderId = getLandingPagePlaceholderSysId(workspace.compiledPageRegistry);

            if(placeholderId == null)
                continue;

            gr.addQuery("placeholder", placeholderId);
            gr.setWorkflow(false);
            gr.query();

            while(gr.next()) {
                var landingPageId = gr.getUniqueValue();
                var name = gr.getValue("name");

                if(gr.isValidField("macroponent"))
                    name = gr.macroponent.getDisplayValue();

                workspace.landingPages[landingPageId] = {
                    name: name,
                    createdOn: gr.getValue("sys_created_on"),
                    order: gr.getValue("order")
                };
            }
        }
    })();

    return workspaces;
    
};

(function(){

	gs.print(JSON.stringify(getWorkspaceData()));

})();