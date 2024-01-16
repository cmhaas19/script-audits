
var getTotalSourceControlRecords = function() {
    var gr = new GlideAggregate("sys_repo_config");
    gr.setWorkflow(false);
    gr.addEncodedQuery("sys_app!=NULL");
    gr.addAggregate("COUNT");
    gr.query();

    return (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);
};

var getSourceControlDetails = function() {
    var repoConfigs = {};
    var regex = /^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/;

    (function(){
        var gr = new GlideRecord("sys_repo_config");
        gr.setWorkflow(false);
        gr.addEncodedQuery("sys_app!=NULL");
        gr.setLimit(140);
        gr.query();

        while(gr.next()) {
            var id = gr.getUniqueValue();
            

            repoConfigs[id] = {
                appId: gr.sys_app.toString(),
                scope: gr.sys_app.scope.toString(),
                midServer: !gr.mid_server.nil(),
                branches: 0,
                tags: 0,
                stashes: 0,
                urlDomain: ""
            }

            if(!gr.url.nil()) {
                try {
                    var matches = regex.exec(gr.getValue("url"));
                    repoConfigs[id].urlDomain = matches[3];
                } catch(e) { }
            }
        }

    })();

    (function(){
        var gr = new GlideAggregate("sys_repo_branch");
        gr.setWorkflow(false);
        gr.groupBy("sys_repo_config");
        gr.addAggregate("COUNT");
        gr.query();

        while(gr.next()) {
            var repoId = gr.sys_repo_config.toString();
            var count = gr.getAggregate("COUNT");

            if(repoConfigs[repoId] != undefined)
                repoConfigs[repoId].branches = count;
        }

    })();

    (function(){
        var gr = new GlideAggregate("sys_repo_tag");
        gr.setWorkflow(false);
        gr.groupBy("sys_repo_config");
        gr.addAggregate("COUNT");
        gr.query();

        while(gr.next()) {
            var repoId = gr.sys_repo_config.toString();
            var count = gr.getAggregate("COUNT");

            if(repoConfigs[repoId] != undefined)
                repoConfigs[repoId].tags = count;
        }

    })();

    (function(){
        var gr = new GlideAggregate("sys_repo_stash");
        gr.setWorkflow(false);
        gr.groupBy("sys_repo_config");
        gr.addAggregate("COUNT");
        gr.query();

        while(gr.next()) {
            var repoId = gr.sys_repo_config.toString();
            var count = gr.getAggregate("COUNT");

            if(repoConfigs[repoId] != undefined)
                repoConfigs[repoId].stashes = count;
        }

    })();


    return repoConfigs;
    
};


(function(){

    var results = {
        totalRecords: getTotalSourceControlRecords(),
        details: getSourceControlDetails()
    };

    gs.print(JSON.stringify(results));

})();