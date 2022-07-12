
const workBook = require('./common/Workbook.js');
const nowExperiences = require('./now-experience');
const legacyWorkspaces = require('./legacy-workspace');
const servicePortals = require('./service-portal');
const components = require('./components');


(function() {

    var wb = new workBook.Workbook("./results/ux-editing-results.xlsx");

    Promise.all([ 
        nowExperiences.getExperiences(), 
        legacyWorkspaces.getWorkspaces(),
        servicePortals.getPortals(),
        components.getComponents()

    ]).then((dataSets) => {
        dataSets.forEach((dataSet) => { 
            wb.addWorksheets(dataSet);
        });

        wb.addSummary(dataSets);
        wb.commit().then(() => console.log("Done"));
    });

})();
