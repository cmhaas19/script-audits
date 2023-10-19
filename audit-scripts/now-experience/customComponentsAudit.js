var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

    if(companyCode == undefined || companyCode == null || companyCode.length == 0)
        return null;

    return companyCode;
};

var getComponents = function() {
    var query = "category=component^extendsISEMPTY^sys_scope.scopeSTARTSWITHx_" + getCompanyCode();
    var results = {
        totalComponents: 0,
        components: []
    };

    results.totalComponents = (function(){
        var gr = new GlideAggregate("sys_ux_macroponent");
        gr.setWorkflow(false);
        gr.addEncodedQuery(query);
        gr.addAggregate("COUNT");
        gr.query();

        return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
    })();
    
    var gr = new GlideRecord("sys_ux_macroponent");
    gr.setWorkflow(false);
    gr.setLimit(180);
    gr.addEncodedQuery(query);
    gr.query();

    while(gr.next()){
        results.components.push({
            id: gr.getUniqueValue(),
            name: gr.getValue("name"),
            category: gr.getValue("category"),
            createdOn: new GlideDateTime(gr.getValue("sys_created_on")).getDate().getValue(),
            createdBy: gr.getValue("sys_created_by"),
            scope: gr.sys_scope.scope.toString()
        });
    }

    return results;

};


(function(){

	var results = getComponents();

	gs.print(JSON.stringify(results));

})();