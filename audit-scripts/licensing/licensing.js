
var isV2 = function() {

    var isEMSDataAvailable =
        gs
        .getProperty("glide.entitlement.ems.data.available", "false")
        .toLowerCase()
        .trim() === "true";
    var isSurfRouting =
        gs
        .getProperty("glide.entitlement.surf_routing", "false")
        .toLowerCase()
        .trim() === "true";

    return !isSurfRouting && isEMSDataAvailable;
};

var getLicensingInfo = function() {
    var results = { 
        isV2: isV2(),
        licenses: []
    };

    if(results.isV2) {

        (function(){
            var gr = new GlideRecord("subscription_entitlement");
            gr.setWorkflow(false);
            gr.query();

            while(gr.next()) {
                var license = {
                    name: gr.getValue("name"),
                    status: gr.getValue("status"),
                    createdOn: gr.getValue("sys_created_on"),
                    startDate: gr.getValue("start_date"),
                    endDate: gr.getValue("end_date"),
                    productCode: gr.getValue("product_code"),
                    subscriptionType: gr.getValue("subscription_type"),
                    measuredRoleTypes: gr.getValue("measured_role_types"),
                    meterType: gr.getValue("meter_type")                    
                    
                };

                results.licenses.push(license);
            }
        })();

    } else {

        (function(){
            var gr = new GlideRecord("license_details");
            gr.setWorkflow(false);
            gr.query();

            while(gr.next()) {
                var license = {
                    name: gr.getValue("name"),
                    status: gr.getValue("expired"),
                    createdOn: gr.getValue("sys_created_on"),
                    startDate: gr.getValue("start_date"),
                    endDate: gr.getValue("end_date"),
                    productCode: gr.getValue("product_code"),
                    subscriptionType: gr.getValue("license_type"),
                    measuredRoleTypes: gr.getValue("measured_role_types"),
                    meterType: gr.getValue("meter_type")
                };

                results.licenses.push(license);
            }
        })();

    }

    

    return results;
};


(function(){

    var results = getLicensingInfo();

    gs.print(JSON.stringify(results));

})();