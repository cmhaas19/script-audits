
var getCompanyCode = function(){
    var companyCode = gs.getProperty("glide.appcreator.company.code");

	if(companyCode == undefined || companyCode == null || companyCode.length == 0)
		return "";

    return companyCode;
};

var getCurrentLanguage = function() {
	var language = "N/A";
	try {
		language = gs.getSession().getLanguage();
	} catch(e) {}

	return language;
};

var getPortals = function() {
    var data = {};

    (function(d){
        var gr = new GlideRecord("sp_portal");

        if(!gr.isValid())
            return;

        gr.setWorkflow(false);
        gr.addQuery('sys_scope.scope', 'NOT LIKE', 'sn_%');
        gr.addQuery('sys_id', 'NOT IN', '81b75d3147032100ba13a5554ee4902b,89275a53cb13020000f8d856634c9c51,bebfa187536a1300a699ddeeff7b1223,db57a91047001200ba13a5554ee49050');        
        gr.query();

        while(gr.next()){
            var portal = {
                title: gr.getValue("title"),
                urlSuffix: gr.getValue("url_suffix"),
                scope: gr.sys_scope.scope.toString(),
                createdOn: gr.getValue("sys_created_on"),
                updatedOn: gr.getValue("sys_updated_on")
            }

            d[gr.getUniqueValue()] = portal;
        }

    })(data);      

    return data;
};

(function() {

    var results = {
        companyCode: getCompanyCode(),
        currentLanguage: getCurrentLanguage(),
        portals: getPortals()
    };

    gs.print(JSON.stringify(results));

})();