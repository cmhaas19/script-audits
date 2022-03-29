
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getTemplates = function() {
    var data = {};

    var gr = new GlideRecord("sys_app_template");

    if(!gr.isValid())
        return data;

    gr.setWorkflow(false);
    gr.setLimit(120);
    gr.query();

    while(gr.next()){

        data[gr.getUniqueValue()] = {
            name: gr.getValue("name"),
            active: (gr.getValue("active") == "1"),
            isApp: (gr.getValue("create_app") == "1"),
            snapshot: (gr.getValue("snapshot") == "1"),
            scope: gr.sys_scope.scope.toString(),
            type: gr.getValue("type"),
            createdOn: new GlideDateTime(gr.getValue("sys_created_on")).getDate().getValue()
        };
    }

    return data;
};

(function(){

    var results = {
        companyCode: getCompanyCode(),
        installedTemplates: getTemplates()
    };

    gs.print(JSON.stringify(results));

})();