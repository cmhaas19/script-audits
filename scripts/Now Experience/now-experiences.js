
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

var getTotalExperienceCount = function() {

    var gr = new GlideAggregate("sys_ux_page_registry");
    gr.setWorkflow(false);
    gr.addAggregate("COUNT");
    gr.addQuery('sys_scope.scope', 'NOT LIKE', 'sn_%');
    gr.addQuery('sys_id', 'NOT IN', Object.keys(EXCLUDED_EXPERIENCES).join(','));
    gr.query();

    return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
}

var getExperiences = function() {
    var data = {};
    var gr = new GlideRecord("sys_ux_page_registry");
        
    if(!gr.isValid())
        return;

    gr.setWorkflow(false);
    gr.setLimit(80);
    gr.addQuery('sys_scope.scope', 'NOT LIKE', 'sn_%');
    gr.addQuery('sys_id', 'NOT IN', Object.keys(EXCLUDED_EXPERIENCES).join(','));
    gr.query();

    while(gr.next()){     
        var uxApplicationId = gr.getUniqueValue();       

        var uxApplication = {
            title: gr.getValue("title"),
            active: (gr.getValue("active") == "1"),
            scope: gr.sys_scope.scope.toString(),
            cDate: new GlideDateTime(gr.getValue("sys_created_on")).getDate().getValue(),
            uDate: new GlideDateTime(gr.getValue("sys_updated_on")).getDate().getValue()
        };

        if(!gr.admin_panel.nil()) {
            var adminPanel = gr.admin_panel.getRefRecord();

            uxApplication.adminPanel = {
                id: gr.getValue("admin_panel"),
                table: gr.getValue("admin_panel_table"),
                name: adminPanel.getValue("name")
            };
        }

        if(!gr.root_macroponent.nil()) {
            uxApplication.appShell = {
                name: gr.root_macroponent.getDisplayValue(),
                cat: gr.root_macroponent.category.getDisplayValue()
            };
        }

        data[uxApplicationId] = uxApplication;
    }

    return data;
};

(function() {

    var results = {
        totalExperiences: getTotalExperienceCount(),
        experiences: getExperiences()
    };

    gs.print(JSON.stringify(results));

})();