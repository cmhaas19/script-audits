

exports.isProductionInstance = (instance) => {
    return (instance && instance.purpose && instance.purpose == "Production");
};

exports.getAccount = (instance) => {
    var account = {
        accountName: "",
        accountNo: "UNKNOWN",
        accountType: "",
        primarySalesRep: "",
        solutionConsultant: "",
        isAppEngineSubscriber: false
    };

    if(instance && instance.account && instance.account.accountNo && instance.account.accountNo.length > 0)
        account = instance.account;

    return account;
};