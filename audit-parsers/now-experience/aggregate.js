
const workBook = require('./common/Workbook.js');
const nowExperiences = require('./now-experience');
const legacyWorkspaces = require('./legacy-workspace');
const servicePortals = require('./service-portal');
const components = require('./components');


(function() {
    var isDistinct = true;
    var fileName = (isDistinct ? "ux-editing-results.xlsx" : "ux-editing-results-all.xlsx");

    var wb = new workBook.Workbook("./results/" + fileName);

    Promise.all([ 
        nowExperiences.getExperiences(isDistinct), 
        //legacyWorkspaces.getWorkspaces(isDistinct),
        servicePortals.getPortals(isDistinct),
        components.getComponents(isDistinct)

    ]).then((dataSets) => {
        dataSets.forEach((dataSet) => { 
            wb.addWorksheets(dataSet);
        });

        wb.addSummary(dataSets);
        wb.commit().then(() => console.log("Done"));
    });

})();
