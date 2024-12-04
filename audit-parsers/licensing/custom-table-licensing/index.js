const path = require('path');
const Audit = require('../../common/AuditWorkbook.js');
const FileLoader = require('../../common/FileLoader.js');
const moment = require("moment");
const { calculateLicenses } = require("./calculate-licenses.js");

const LICENSE_SOURCE_CODES = {
    1: "subscription",
    2: "extension",
    3: "referring field",
    4: "reference field",
    5: "relationship to",
    6: "relationship from",
    7: "flow action",
    8: "flow trigger"
};

function invertLicenseMap(l) {
    const licenses = {};
    for (const [license, code] of Object.entries(l)) {
      licenses[code] = license;
    }
    return licenses;
}

function isGrandFatheredLicense(license) {
    const grandFatheredLicenses = [
      "($0 ACV) Grandfathered Custom Tables - Custom Tables",
      "(WITH ACV) Grandfathered Custom Tables - Custom Tables",
      "Grandfathered Custom Tables - Custom Tables"
    ];
  
    return grandFatheredLicenses.includes(license);
  }

  function processData(data) {
    const { l, t } = data;
    const licensesMap = invertLicenseMap(l);
    const result = {};
    for (const [table, d] of Object.entries(t)) {
      let relatedLicensesAndTables = d.r.map(({ t, s, l }) => {
        const source = {
          code: s,
          label: LICENSE_SOURCE_CODES[s]
        };
        if (t) {
          return { table: t, source };
        }
        const license = licensesMap[l];
        return { license, source };
      });
  
      relatedLicensesAndTables.filter(
        (entry) => !isGrandFatheredLicense(entry.license)
      );
  
      const license = licensesMap[d.l];
      const assignedLicense = isGrandFatheredLicense(license) ? null : license;
      const hasAssignedLicense = !!license;
      result[table] = {
        hasAssignedLicense,
        assignedLicense: assignedLicense,
        relatedLicensesAndTables
      };
    }
  
    return result;
  }

(function(){

    var fileName = path.join(__dirname, "results-test.json");       

    FileLoader.loadFileWithInstancesAndAccounts(fileName).then((auditData) => {

      var totalTables = 0;

        auditData.forEach((row) => {
            if(row.data && row.data.t) {
                var tables = Object.keys(row.data.t).length;
                totalTables += tables;
            }
        });

        console.log("Total tables: " + totalTables);


    });

})();