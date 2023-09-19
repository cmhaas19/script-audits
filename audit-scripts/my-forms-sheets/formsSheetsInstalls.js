


var getStoreAppDetails = function(scope) {
    var gr = new GlideRecord("sys_store_app");
    gr.setWorkflow(false);
    gr.addQuery("scope=" + scope);
    gr.query();

    var details = {
        installed: false,
        installedOn: "",
        version: ""
    };

    if(gr.next()) {
        details.installed = true;
        details.installedOn = gr.getValue("install_date");
        details.version = gr.getValue("version");
    }

    return details;
};

var getMySheetDetails = function(){
    var details = {
        appInfo: getStoreAppDetails("sn_mysheets"),
        workspaces: []
    };

    var workspaces = {};

    if(details.appInfo.installed) {

        //
        // Cache column counts
        //
        var columns = (function(){
            var gr = new GlideAggregate("sn_mysheets_column");
            gr.setWorkflow(false);
            gr.addAggregate("COUNT");
            gr.groupBy("sheet");
            gr.query();

            var columns = {};

            while(gr.next()){
                columns[gr.sheet.toString()] = parseInt(gr.getAggregate("COUNT"));
            }

            return columns;
        })();

        //
        // Cache row counts
        //
        var rows = (function(){
            var gr = new GlideAggregate("sn_mysheets_row");
            gr.setWorkflow(false);
            gr.addAggregate("COUNT");
            gr.groupBy("sheet");
            gr.query();

            var rows = {};

            while(gr.next()){
                rows[gr.sheet.toString()] = parseInt(gr.getAggregate("COUNT"));
            }

            return rows;
        })();

        //
        // Get Sheets
        //
        (function(){
            var gr = new GlideRecord("sn_mysheets_sheet");
            gr.setWorkflow(false);
            gr.query();

            while(gr.next()) {
                var workspaceId = gr.book.workspace.toString();
                var bookId = gr.book.toString();
                var sheetId = gr.getUniqueValue();

                if(workspaces[workspaceId] == undefined) {
                    workspaces[workspaceId] = { 
                        createdOn: new GlideDateTime(gr.getElement("book.workspace.sys_created_on").getValue()).getDate().getValue(), 
                        books: {} 
                    };
                }

                if(workspaces[workspaceId].books[bookId] == undefined) {
                    workspaces[workspaceId].books[bookId] = { 
                        createdOn: new GlideDateTime(gr.getElement("book.sys_created_on").getValue()).getDate().getValue(), 
                        sheets: {} 
                    };
                }

                if(workspaces[workspaceId].books[bookId].sheets[sheetId] == undefined) {
                    workspaces[workspaceId].books[bookId].sheets[sheetId] = { 
                        createdOn: new GlideDateTime(gr.getValue("sys_created_on")).getDate().getValue(), 
                        columns: 0, 
                        rows: 0 
                    };
                }

                if(columns[sheetId] != undefined)
                    workspaces[workspaceId].books[bookId].sheets[sheetId].columns = columns[sheetId];

                if(rows[sheetId] != undefined)
                    workspaces[workspaceId].books[bookId].sheets[sheetId].rows = rows[sheetId];
            }

        })();

        //
        // Convert to use arrays for smaller payload
        //
        for(var workspaceId in workspaces) {
            var workspace = { createdOn: workspaces[workspaceId].createdOn, books: []};

            for(var bookId in workspaces[workspaceId].books){
                var book = { createdOn: workspaces[workspaceId].books[bookId].createdOn, sheets: [] };

                for(var sheetId in workspaces[workspaceId].books[bookId].sheets){
                    var sheet = workspaces[workspaceId].books[bookId].sheets[sheetId];
                    book.sheets.push(sheet);
                }

                workspace.books.push(book);
            }

            details.workspaces.push(workspace);
        }
    }

    return details;
};

var getMyFormDetails = function(){
    var details = {
        appInfo: getStoreAppDetails("sn_myforms"),
        totalForms: 0,
        forms: []
    };

    if(details.appInfo.installed) {

        (function(){
            var gr = new GlideAggregate("sn_myforms_form");
            gr.setWorkflow(false);
            gr.addAggregate("COUNT");
            gr.query();

            details.totalForms = (gr.next() ? parseInt(gr.getAggregate("COUNT")) : 0);

        })();

        var responses = (function(){
            var gr = new GlideAggregate("sn_myforms_recipient");
            gr.setWorkflow(false);
            gr.addAggregate("COUNT");
            gr.groupBy("form");
            gr.query();

            var responses = {};

            while(gr.next()) {
                responses[gr.form.toString()] = parseInt(gr.getAggregate("COUNT"));
            }

            return responses;

        })();

        (function(){
            var gr = new GlideRecord("sn_myforms_form");
            gr.setWorkflow(false);
            gr.setLimit(500);
            gr.query();

            while(gr.next()) {
                var formId = gr.getUniqueValue();
                var form = { 
                    createdOn: new GlideDateTime(gr.getValue("sys_created_on")).getDate().getValue(), 
                    state: gr.getValue("state"), 
                    responses: 0 
                };

                if(responses[formId] != undefined)
                    form.responses = responses[formId];

                details.forms.push(form);
            }

        })();
    }

    return details;
};


(function(){

	var auditResults = {
        mySheets: getMySheetDetails(),
        myForms: getMyFormDetails()
	};

	gs.print(JSON.stringify(auditResults));

})();