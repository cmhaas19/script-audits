
var EXCLUDED_EXPERIENCES = {
    "2cbe185e0fb12010d620d55566767e33": "Adoption Services",
    "096bd1fb0fc32010d620d55566767e85": "Adoption Services Builder",
    "ad03e8565392101057f1ddeeff7b125a": "IntegrationHub Studio",
    "a84adaf4c700201072b211d4d8c260b7": "Unified Navigation App",
    "b409e647076320105fca5d1aead30099": "ATF Unified Nav",
    "3fb0e735530130106796ddeeff7b1260": "Flow Template",
    "e6bb67925b21201058eefe3dda81c79f": "Export pages",
    "fd5428035b632010a12068aa3d81c7ca": "export to pdf"
};

var getExperienceScreens = function() {
    var data = {};
    var appConfigs = {};

    (function(){
        var gr = new GlideRecord("sys_ux_page_registry");
        
        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.setLimit(100);
        gr.addQuery('sys_scope.scope', 'NOT LIKE', 'sn_%');
        gr.addQuery('sys_id', 'NOT IN', Object.keys(EXCLUDED_EXPERIENCES).join(','));
        gr.query();

        while(gr.next()){     
            var uxApplicationId = gr.getUniqueValue();
            
            if(!gr.admin_panel.nil()) {
                data[uxApplicationId] = {};
                appConfigs[gr.getValue("admin_panel")] = uxApplicationId;
            }
        }
    })();

    var rootComponentIds = (function(){
        var ids = {};
	
        var gr = new GlideRecord('sys_ux_page_registry');
        gr.setWorkflow(false);
        gr.addQuery('admin_panel_table', 'sys_ux_app_config');
        gr.query();

        while (gr.next()) {
            var id = gr.getValue('root_macroponent');

            if(ids[id] == undefined)
                ids[id] = true;
        }

        return Object.keys(ids);
    })();

    //
    //  Get screen collections and associated variants
    //
    (function(){
        var gr = new GlideRecord("sys_ux_screen");
        gr.setWorkflow(false);
        
        gr.addQuery("screen_type", "!=", "NULL");
        gr.addQuery("app_config", "IN", Object.keys(appConfigs).join(","));

        var qc = gr.addQuery('parent_macroponent', 'IN', rootComponentIds.join(','));
        qc.addOrCondition('parent_macroponent', null);
  
        gr.query();

        while(gr.next()) {
            var screenCollection = gr.screen_type.name.toString();
            var experienceId = appConfigs[gr.getValue("app_config")];
            var experience = data[experienceId];

            if(experience[screenCollection] == undefined)
                experience[screenCollection] = [];

            experience[screenCollection].push(gr.getValue("name"));
        }
    })();       

    return data;
};

(function() {

    var results = {
        experiences: getExperienceScreens()
    };

    gs.print(JSON.stringify(results));

})();