/**
 * Example outpuut:
 * 
 
 * 
 */
function initGlideRecord (tableName){
    if (!GlideTableDescriptor.isValid(tableName)) return;
    var gr = new GlideAggregate(tableName);
    if(!gr.isValid()) return;
    gr.setWorkflow(false);
    return gr;
}

var getApplicationUsage = function() {
    var appUsage = {};
    var appNames = [
        'Catalog Builder'
    ];

    var gr = initGlideRecord("ua_app_usage");
    if(!gr) return appUsage;
	gr.addEncodedQuery("app_nameIN" + appNames.join(","));
    gr.addAggregate("COUNT");
    gr.groupBy("app_name");
    gr.groupBy("time_stamp");
    gr.query();

    while(gr.next()) {
        var appName = gr.app_name.toString(),
            accrualPeriod = gr.time_stamp.toString(),
            count = parseInt(gr.getAggregate("COUNT"));

        if(appUsage[appName] == undefined)
            appUsage[appName] = {};

        appUsage[appName][accrualPeriod] = count;
    }

    return appUsage;
};

var getUIPolicies = function () {
    var services = [];
    // Set to -1 to indicate an issue with querying the table in the final output
    var results = {};

    (function(){
        var gr = initGlideRecord("catalog_ui_policy_action");
        if(!gr) return;
		gr.addEncodedQuery("ui_policy.active=true^ui_policy.ref_catalog_ui_policy.applies_to=item");
        gr.query();

        var resultMap = {};
        while (gr.next()) {
			var catalogItem = gr.getDisplayValue("catalog_item");
			if(!resultMap[catalogItem]){
				resultMap[catalogItem] = {
					catalogItem: catalogItem,
					policies: {}
				};
			}
			var catlogObj = resultMap[catalogItem];
            var policy = gr.getDisplayValue("ui_policy");
            if(!catlogObj.policies[policy]){
                catlogObj.policies[policy] = {
					condition: gr.getValue("ui_policy.catalog_conditions"),
					appliesTo: gr.getValue("ui_policy.applies_to"),
					actionCount: 0
				};
            }
			var policyObj = catlogObj.policies[policy];

			// resultMap[policy].name = gr.getDisplayValue("ui_policy");
			// policyObj.catalogItem = gr.getDisplayValue("catalog_item");
			var actionsSysId = gr.getUniqueValue();
			// gs.print(actionsSysId);
			if(!policyObj[actionsSysId]){
				policyObj[actionsSysId] = {};
			}
			policyObj[actionsSysId].onVariable = gr.getValue("variable");
			// policyObj[actionsSysId].disabled = gr.getValue("disabled");
			// policyObj[actionsSysId].mandatory = gr.getValue("mandatory");
			// policyObj[actionsSysId].visible = gr.getValue("visible");
			// policyObj[actionsSysId].showMessage = gr.getValue("field_message_type");
			// policyObj[actionsSysId].clearValue = gr.getValue("cleared");
			// policyObj[actionsSysId].setValue = gr.getValue("value");
			policyObj.actionCount++;
			
        }
        results.catalogItemPolicies = resultMap;

    })();

    return results;
}

var setSessionLanguage = function() {
    try {
        gs.getSession().setLanguage("en");
    } catch(e) { }
};
// Function to filter policies with actionCount > 1
var filterPolicies = function(data) {
  // Create a deep copy of the data object (manual copy for simplicity in ES5)
  var filteredData = JSON.parse(JSON.stringify(data));
  var catalogItemPolicies = filteredData.uiPolcies.catalogItemPolicies;

  // Iterate over each catalog item
  for (var catalogItem in catalogItemPolicies) {
    if (catalogItemPolicies.hasOwnProperty(catalogItem)) {
      var policies = catalogItemPolicies[catalogItem].policies;

      // Iterate over each policy in the catalog item
      for (var policyKey in policies) {
        if (policies.hasOwnProperty(policyKey)) {
          var policyValue = policies[policyKey];

          // Get all keys in the policy, excluding known metadata fields
          var actionKeys = Object.keys(policyValue).filter(function(key) {
            return key !== "condition" && key !== "appliesTo" && key !== "actionCount";
          });

          // If there is exactly 1 action key, delete the policy
          if (actionKeys.length === 1) {
            delete policies[policyKey];  // Remove the policy
          }
        }
      }

      // After filtering, if no policies remain, remove the entire catalog item
      if (Object.keys(policies).length === 0) {
        delete catalogItemPolicies[catalogItem];  // Remove the catalog item if it's empty
      }
    }
  }

  return filteredData;
};

(function(){

    setSessionLanguage();

    var results = {
        // applicationUsage: getApplicationUsage(),
        uiPolcies: getUIPolicies()
    };

	var filteredResult = filterPolicies(results);
    gs.print(JSON.stringify(filteredResult, null, 2));
	// gs.print(JSON.stringify(results, null, 2));

})();