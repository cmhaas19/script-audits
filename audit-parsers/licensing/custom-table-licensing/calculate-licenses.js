"use strict";

const {
  KNOWN_OOTB_TABLES,
  KNOWN_STORE_TABLES
} = require("./excluded_tables.js");

const { RecommenderConstants } = require("./recommender-constants");

// Fake glide functions to minimize code divergence with SM codebase
const gs = {
  getMessage: (...args) => {
    let str = args[0];
    for (let i = 1; i < args.length; i++) {
      str = str.replace(`{${i - 1}}`, args[i]);
    }
    return str;
  },
  error: (msg) => console.error(msg)
};

let DATA = null;

let CUSTOM_TABLE_NAMES = [];

// Holds the final licenses for all the tables
// e.g. {
//     tableName: [
//         license1,
//         license2,
//     ]
// }
let TABLE_LICENSE_LOOKUP = {};

// Holds the final license weight for all the tables
// e.g. {
//     tableName: [
//         weight1,
//         weight2,
//     ]
// }
let TABLE_LICENSE_WEIGHT_LOOKUP = {};

// Holds the reason type for license assignment
// e.g. {
//     tableName: [
//         [                  <--- license1
//             reasonType,    <--- reason1
//             reasonType     <--- reason2
//         ],
//         [                  <--- license2
//             reasonType,    <--- reason1
//             reasonType,    <--- reason2
//             reasonType     <--- reason3
//         ]
//     ];
// }
let TABLE_LICENSE_REASON_LOOKUP = {};

// Holds the detailed reason for license assignment
// e.g. {
//     tableName: [
//         reasonText,
//         reasonText,
//     ]
// }
let TABLE_LICENSE_REASON_TEXT_LOOKUP = {};

// Holds the final license paths for all the tables
// e.g. {
//     tableName: [
//         [                            <--- license1
//             ['table1', 'table2'],    <--- path1
//             ['table3', 'table4']     <--- path2
//         ],
//         [                            <--- license2
//             ['table5', 'table6'],    <--- path1
//             ['table7', 'table8'],    <--- path2
//             ['table9', 'table10']    <--- path3
//         ]
//     ];
// }
let TABLE_LICENSE_PATH_LOOKUP = {};

// Holds the tables and their related tables in hierarchical form
let LINKED_TABLE_LOOKUP = {};

let FILE_NAME = null;

let STATS = null;

let ALL_STATS = {
  maxTables: 0,
  maxStrongIterations: 0,
  maxWeakIterations: 0,
  maxLicenseNum: 0,
  maxObjectSize: 0,
  excluded: 0,
  total: 0,
  hasLicence: 0,
  nullLicense: 0,
  recommendations: Array(RecommenderConstants.NUM_RECOMMENDATIONS)
    .fill(null)
    .map((ele, idx) => ({
      idx,
      appEngine: 0,
      OOTBLicense: 0,
      same: 0,
      different: 0,
      licenseCounts: {},
      weights: {}
    }))
};

// Resets all the variables before each run. Critical when
// running on the node version, optional when on SM as
// the scheduled job runs a new instance of script
// include everytime.
function resetGlobalVariables(fileName) {
  // Do not reset anything which you want to calculate over all files.
  DATA = null;
  TABLE_LICENSE_LOOKUP = {};
  TABLE_LICENSE_WEIGHT_LOOKUP = {};
  TABLE_LICENSE_PATH_LOOKUP = {};
  TABLE_LICENSE_REASON_LOOKUP = {};
  TABLE_LICENSE_REASON_TEXT_LOOKUP = {};

  LINKED_TABLE_LOOKUP = {};
  FILE_NAME = fileName;
  STATS = {
    maxTables: 0,
    maxStrongIterations: 0,
    maxWeakIterations: 0,
    maxLicenseNum: 0,
    maxObjectSize: 0,
    excluded: 0,
    total: 0,
    hasLicence: 0,
    nullLicense: 0,
    recommendations: Array(RecommenderConstants.NUM_RECOMMENDATIONS)
      .fill(null)
      .map((ele, idx) => ({
        idx,
        appEngine: 0,
        OOTBLicense: 0,
        same: 0,
        different: 0,
        licenseCounts: {},
        weights: {}
      }))
  };
}

// If a table has an assigned license, then set it as the correct license.
// We always take the customer assignment as the correct license.
function handleAssignedLicenses() {
  for (const table of CUSTOM_TABLE_NAMES) {
    // don't redo tables that we have already resolved
    if (TABLE_LICENSE_LOOKUP[table]) continue;

    // Do not use hasAssignedLicense here since grandfathered licenses
    // will have the flag set to true but will have a license of null.
    const { assignedLicense } = DATA[table];
    if (assignedLicense) {
      TABLE_LICENSE_LOOKUP[table] = [assignedLicense];
      TABLE_LICENSE_WEIGHT_LOOKUP[table] = [
        RecommenderConstants.RELATION_DETAILS[
          RecommenderConstants.RELATION_CODES.assignment
        ].weight
      ];
      TABLE_LICENSE_REASON_LOOKUP[table] = [
        [RecommenderConstants.REASONS.ASSIGNMENT]
      ];
      TABLE_LICENSE_PATH_LOOKUP[table] = [[[table]]];
    }
  }
}

// Find licenses which cross the threshold in a single relation.
// If a strong license is found, then we should recommend it
// regardless of what happens with weak license weights.
// This will only be true for extensions and subscriptions right now.
function findStrongLicenses(table, relatedLicensesAndTables) {
  const licensesCrossingThreshold = [];
  const seenLicenses = {};
  const seenTableLicenses = {};

  for (const entry of relatedLicensesAndTables) {
    const depTable = entry.table;
    const code = entry.source.code;
    const weight = RecommenderConstants.RELATION_DETAILS[code].weight;

    if (weight > RecommenderConstants.LICENSE_THRESHOLD) {
      // Weight is greater than threshold, so look for licenses
      if (entry.license) {
        if (seenLicenses[entry.license]) {
          // The license already exists, and the source of the license
          // is the same (i.e. the table itself), so we can ignore it
          continue;
        }

        seenLicenses[entry.license] = true;

        // The license entry is present because the table is related to
        // a ServiceNow OOTB table or the custom tables scope or package
        // was found in ua_app_family table.
        const path = [table];

        if (depTable && !DATA[depTable]) {
          // This table is not on custom relations, so it has to be
          // a ServiceNow OOTB table. Only happens for extension relations.
          path.push(depTable);
        }

        licensesCrossingThreshold.push({
          code,
          license: entry.license,
          path,
          weight
        });
      } else if (depTable && TABLE_LICENSE_LOOKUP[depTable]) {
        // There is a related custom table with one or more licenses in it.
        TABLE_LICENSE_LOOKUP[depTable].forEach((license, idx) => {
          const key = `${depTable}__${license}`;
          if (seenTableLicenses[key]) {
            return;
          }
          seenTableLicenses[key] = true;

          // All the paths have to be length 1 since only
          // assigned licenses have been processed at this point.
          const path = TABLE_LICENSE_PATH_LOOKUP[depTable][idx][0];
          const entry = {
            code,
            license,
            path: [table],
            weight
          };
          entry.path = entry.path.concat(path);
          licensesCrossingThreshold.push(entry);
        });
      }
    }
  }

  return licensesCrossingThreshold;
}

// Sets the strong licenses found for the table
function setStrongLicenseForTable(table, licensesCrossingThreshold) {
  TABLE_LICENSE_LOOKUP[table] = licensesCrossingThreshold.map(
    (val) => val.license
  );

  TABLE_LICENSE_REASON_LOOKUP[table] = licensesCrossingThreshold.map((val) => {
    if (val.code === 1) {
      return [RecommenderConstants.REASONS.SUBSCRIPTION];
    } else if (val.code === 2) {
      return [RecommenderConstants.REASONS.EXTENDS];
    }
  });

  TABLE_LICENSE_WEIGHT_LOOKUP[table] = licensesCrossingThreshold.map(
    (val) => val.weight
  );

  TABLE_LICENSE_PATH_LOOKUP[table] = licensesCrossingThreshold.map((val) => [
    val.path
  ]);
}

// Handle the strong licenses in the graph. If there are multiple
// strong licenses, then we will be recommending all of them.
function handleStrongRelations() {
  let iteration = 0;
  let changeDetected = false;

  // Loop over the graph propagating all strong license relations.
  // Iterate till we see no changes in the graph or if we hit the max iteration limit.
  do {
    iteration++;
    changeDetected = false;

    for (const table of CUSTOM_TABLE_NAMES) {
      // don't redo tables that we have already resolved
      if (TABLE_LICENSE_LOOKUP[table]) continue;

      const { relatedLicensesAndTables } = DATA[table];

      const licensesCrossingThreshold = findStrongLicenses(
        table,
        relatedLicensesAndTables
      );

      // TODO : Sort and remove from here?
      licensesCrossingThreshold.sort((a, b) =>
        a.license.localeCompare(b.license)
      );

      // Limit the recommendations to RecommenderConstants.NUM_RECOMMENDATIONS
      licensesCrossingThreshold.splice(
        RecommenderConstants.NUM_RECOMMENDATIONS,
        Infinity
      );

      // This will only be true if it's a subscription or an extension
      // since only they have weights to cross license thresholds
      if (licensesCrossingThreshold.length) {
        // We found a change, so we will set the changeDetected flag
        changeDetected = true;
        setStrongLicenseForTable(table, licensesCrossingThreshold);
      }
    }
  } while (
    changeDetected &&
    iteration < RecommenderConstants.MAX_PASS_ITERATIONS
  );

  STATS.maxStrongIterations = iteration;
  ALL_STATS.maxStrongIterations = Math.max(
    ALL_STATS.maxStrongIterations,
    iteration
  );

  // We were unable to converge in RecommenderConstants.MAX_PASS_ITERATIONS
  // This should ideally never happen, but 100 iterations
  // is reasonably good enough.
  if (iteration === RecommenderConstants.MAX_PASS_ITERATIONS) {
    gs.error(
      "Max iterations has been hit for handleStrongRelations : " + FILE_NAME
    );
  }
}

// Creates and sets the relations (aka edges/links) on the graph.
function setTableInfoOnLinkedTableLookup(table, filteredTables) {
  for (const entry of filteredTables) {
    const relatedTable = entry.table;
    const code = entry.source.code;
    const weight = RecommenderConstants.RELATION_DETAILS[code].weight;

    if (LINKED_TABLE_LOOKUP[table].info[relatedTable]) {
      // Multiple references to the same table
      LINKED_TABLE_LOOKUP[table].info[relatedTable].weight += weight;
    } else {
      // New linked table found
      LINKED_TABLE_LOOKUP[table].info[relatedTable] = { weight };
      LINKED_TABLE_LOOKUP[table].relatedTables.push(relatedTable);
    }
  }
}

// Creates and sets the licenseMap for a table.
// The licenseMap contains all the licenses which exist on the table.
// These licenses exist because the table is in a package or scope or
// it extends a table (custom or OOTB) which is iin the package or scope.
// If there are duplicates, then they are merged into one.
function setLicenseMapOnLinkedTableLookup(table, filteredLicenses) {
  for (const entry of filteredLicenses) {
    const license = entry.license;
    const code = entry.source.code;
    const weight = RecommenderConstants.RELATION_DETAILS[code].weight;

    // License Map key should not be impacted by decay.
    // This ensures that we can uniquely identify a license.
    const key = `${table}__${license}__${weight}`;

    if (key in LINKED_TABLE_LOOKUP[table].licenseMap) {
      // The same license exists multiple times on a table
      LINKED_TABLE_LOOKUP[table].licenseMap[key].weight += weight;
    } else {
      // New license found
      LINKED_TABLE_LOOKUP[table].licenseMap[key] = {
        table,
        license,
        weight,
        path: [table]
      };
    }
  }
}

// Creates the graph for processing during weak relation iterations.
function setupLinkedTablesLookup() {
  for (const table of CUSTOM_TABLE_NAMES) {
    LINKED_TABLE_LOOKUP[table] = LINKED_TABLE_LOOKUP[table] || {
      // Detailed info about relations for the table
      info: {},
      // List of all tables that are related to this table
      // We use this for looping purposes.
      relatedTables: [],
      // Detailed info about licenses on the table
      licenseMap: {}
    };
    const { relatedLicensesAndTables } = DATA[table];
    const filteredTables = relatedLicensesAndTables.filter(
      (rl) => !("license" in rl)
    );
    const filteredLicenses = relatedLicensesAndTables.filter(
      (rl) => "license" in rl
    );

    if (filteredTables.length) {
      setTableInfoOnLinkedTableLookup(table, filteredTables);
    }

    if (filteredLicenses.length) {
      setLicenseMapOnLinkedTableLookup(table, filteredLicenses);
    }

    // Table Info and Related Tables should never change after this
    Object.freeze(LINKED_TABLE_LOOKUP[table].info);
    Object.freeze(LINKED_TABLE_LOOKUP[table].relatedTables);
  }

  // No new tables can be added in the graph anymore.
  Object.freeze(LINKED_TABLE_LOOKUP);
}

// Gets licenseMap for tables which were resolved in handleAssignedLicenses
// or in handleStrongRelations.
function getLicenseMapForResolvedTable(depTable, relationWeight) {
  let depLicenseMap = {};
  TABLE_LICENSE_LOOKUP[depTable].forEach((license, idx) => {
    const allPaths = TABLE_LICENSE_PATH_LOOKUP[depTable][idx];
    allPaths.forEach((path) => {
      // We need to use the table which was the original source
      // of the license, this could be depTable itself
      // or a ServiceNow OOTB (only for extensions)
      const lastTable = path[path.length - 1];
      // License Map keys should not be impacted by decay.
      // This ensures that we can uniquely identify a license.
      const key = `${lastTable}__${license}__${relationWeight}`;
      depLicenseMap[key] = {
        table: depTable,
        license,
        path
      };
    });
  });

  return depLicenseMap;
}

// Merges related table's licenseMap into self.
function mergeLicenseMapInTable(table, depLicenseMap, weight) {
  let mapChangeDetected = false;
  for (let licenseEntry of Object.keys(depLicenseMap)) {
    if (!(licenseEntry in LINKED_TABLE_LOOKUP[table].licenseMap)) {
      // New license was detected
      mapChangeDetected = true;
      const entry = {
        license: depLicenseMap[licenseEntry].license,
        weight,
        path: [table]
      };
      entry.path = entry.path.concat(depLicenseMap[licenseEntry].path);

      // Copy the dependent table's license to self.
      LINKED_TABLE_LOOKUP[table].licenseMap[licenseEntry] = entry;
    }
  }

  return mapChangeDetected;
}

// Handle the strong licenses in the graph. If there are multiple
// weak licenses, then we will recommend all the ones which have the max weight.
function handleWeakRelations() {
  const linkedTables = Object.keys(LINKED_TABLE_LOOKUP);
  let iteration = 0;
  let changeDetected = false;
  let decayMultiplier = 1;

  // Loop over the graph propagating all license relations.
  // Iterate till we see no changes in the graph or if we hit the max iteration limit.
  do {
    if (decayMultiplier <= 0) {
      // Decay has reduced all weights to zero, so we can stop now.
      break;
    }

    iteration++;
    changeDetected = false;

    for (const table of linkedTables) {
      for (const depTable of LINKED_TABLE_LOOKUP[table].relatedTables) {
        let relationWeight = LINKED_TABLE_LOOKUP[table].info[depTable].weight;
        let depLicenseMap = {};

        if (TABLE_LICENSE_LOOKUP[depTable]) {
          depLicenseMap = getLicenseMapForResolvedTable(
            depTable,
            relationWeight
          );
        } else {
          depLicenseMap = LINKED_TABLE_LOOKUP[depTable].licenseMap;
        }

        // mapChangeDetected is used to figure out if the licenseMap changed due to mergeLicenseMapInTable
        const mapChangeDetected = mergeLicenseMapInTable(
          table,
          depLicenseMap,
          Math.floor(relationWeight * decayMultiplier)
        );

        // If there was a change, then changeDetected will be set to true for this iteration,
        // signaling that convergence has not reached, and we need to continue iterating.
        changeDetected = changeDetected || mapChangeDetected;
      }
    }
    decayMultiplier = decayMultiplier - RecommenderConstants.DECAY;
  } while (
    changeDetected &&
    iteration < RecommenderConstants.MAX_PASS_ITERATIONS
  );

  STATS.maxWeakIterations = iteration;
  ALL_STATS.maxWeakIterations = Math.max(
    ALL_STATS.maxWeakIterations,
    iteration
  );

  // We were unable to converge in RecommenderConstants.MAX_PASS_ITERATIONS
  // This should ideally never happen, but 100 iterations
  // is reasonably good enough.
  if (iteration === RecommenderConstants.MAX_PASS_ITERATIONS) {
    gs.error(
      "Max iterations has been hit for handleWeakRelations : " + FILE_NAME
    );
  }
}

// Creates a lookup of licenses for the table
function setLicenseCandidates(candidates = {}, license, weight) {
  if (!candidates[license]) {
    // New license was found
    candidates[license] = 0;
  }

  candidates[license] += weight;
}

// Sets the licenses in their order of weights. Will limit the number of licenses
// based on the NUM_RECOMMENDATIONS value.
function setBestFitLicenses(table, licenseCandidates) {
  const maxLicenses = Array(RecommenderConstants.NUM_RECOMMENDATIONS).fill(
    null
  );
  const maxWeights = Array(RecommenderConstants.NUM_RECOMMENDATIONS).fill(
    -Infinity
  );

  // Set the first element to App Engine, if there are better options, then
  // this license will eventually be evicted
  maxLicenses[0] = RecommenderConstants.FALLBACK_LICENSE;
  maxWeights[0] = RecommenderConstants.FALLBACK_LICENSE_WEIGHT;

  for (const [licenseCandidate, licenseWeight] of Object.entries(
    licenseCandidates
  )) {
    for (let i = 0; i < RecommenderConstants.NUM_RECOMMENDATIONS; i++) {
      // TODO can we check for name here?
      // We have found a license with higher weight than one in our list
      // or the license has equal weight but is lexically ahead.
      // So we need to add it to the current spot and move others to the right

      if (
        i === 0 &&
        maxWeights[i] === 1000 &&
        licenseWeight === maxWeights[i] &&
        licenseCandidate < maxLicenses[i]
      ) {
        console.log(FILE_NAME, table);
      }

      if (
        licenseWeight > maxWeights[i] ||
        (licenseWeight === maxWeights[i] && licenseCandidate < maxLicenses[i])
      ) {
        maxLicenses.splice(i, 0, licenseCandidate);
        maxWeights.splice(i, 0, licenseWeight);
        break;
      }
    }
  }

  // Remove anything after RecommenderConstants.NUM_RECOMMENDATIONS recommendations
  maxLicenses.splice(RecommenderConstants.NUM_RECOMMENDATIONS, Infinity);
  maxWeights.splice(RecommenderConstants.NUM_RECOMMENDATIONS, Infinity);

  // Remove unallocated entries from the Array.
  for (let i = 0; i < RecommenderConstants.NUM_RECOMMENDATIONS; i++) {
    if (maxLicenses[i] === null) {
      maxLicenses.splice(i, Infinity);
      maxWeights.splice(i, Infinity);
      break;
    }
  }

  // Set the licenses on TABLE_LICENSE_LOOKUP
  TABLE_LICENSE_LOOKUP[table] = maxLicenses;
  TABLE_LICENSE_WEIGHT_LOOKUP[table] = maxWeights;

  return { maxLicenses, maxWeights };
}

// Calculates and Sets the path for the best licenses found in setBestFitLicenses
function setBestFitPaths(table, licenseMap, maxLicenses) {
  const bestFitPaths = [];
  const bestReasons = [];

  // This lookup ensures that we do not use the same ServiceNow table as the endpoint
  // all the time. This will force the process to choose a new one for each path.
  let relatedLicensesAndTablesLookup = {};

  for (let license of maxLicenses) {
    const paths = [];
    const reasons = [];

    if (license === RecommenderConstants.FALLBACK_LICENSE) {
      // Default was selected, so there is path association required
      bestReasons.push([RecommenderConstants.REASONS.DEFAULT]);
      bestFitPaths.push([]);
      continue;
    }

    for (const [_, value] of Object.entries(licenseMap)) {
      if (value.license === license) {
        const path = value.path;
        const lastTable = path[path.length - 1];

        if (!DATA[lastTable]) {
          // The last table is a ServiceNow table, so we
          // don't need to modify anything on this path.
          // This happens due to handleStrongRelations() function
          // which pushes the required ServiceNow table
          reasons.push(RecommenderConstants.REASONS.RELATION_OOTB);
        } else if (DATA[lastTable] && !DATA[lastTable].assignedLicense) {
          // There is no assigned license on the last table in path, so this is not
          // the end of the path and should link to a OOTB table.
          const { relatedLicensesAndTables } = DATA[lastTable];

          if (!relatedLicensesAndTablesLookup[lastTable]) {
            relatedLicensesAndTablesLookup[lastTable] = JSON.parse(
              JSON.stringify(relatedLicensesAndTables)
            );
          }

          let foundEntry = null;
          for (let entry of relatedLicensesAndTablesLookup[lastTable]) {
            if (entry.license === license && !entry.used) {
              foundEntry = entry;
              break;
            }
          }

          if (foundEntry) {
            foundEntry.used = true;
            path.push(foundEntry.table);
          } else {
            // This should never happen since all paths should have an endpoint.
            // If this error is triggered, then it implies that there was a path
            // pointing to a OOTB table which was already marked as used by
            // another path.
            gs.error(
              `Missing foundEntry : ${FILE_NAME} for table: ${table} and lastTable: ${lastTable}`
            );
          }

          reasons.push(RecommenderConstants.REASONS.RELATION_OOTB);
        } else {
          // There is an assigned license on the last table in path, so the last
          // table is the source of the license. This will happen only for custom
          // tables as OOTB tables cannot have assigned license.
          reasons.push(RecommenderConstants.REASONS.RELATION_CUSTOM);
        }

        paths.push(value.path);
      }
    }

    bestReasons.push(reasons);
    bestFitPaths.push(paths);
  }

  TABLE_LICENSE_PATH_LOOKUP[table] = bestFitPaths;
  TABLE_LICENSE_REASON_LOOKUP[table] = bestReasons;

  return bestFitPaths;
}

function setBestFitLicensesAndPaths() {
  const tables = Object.keys(LINKED_TABLE_LOOKUP);
  for (const table of tables) {
    if (TABLE_LICENSE_LOOKUP[table]) continue;

    const licenseCandidates = {};
    const licenseMap = LINKED_TABLE_LOOKUP[table].licenseMap;

    for (const key of Object.keys(licenseMap)) {
      setLicenseCandidates(
        licenseCandidates,
        licenseMap[key].license,
        licenseMap[key].weight
      );
    }

    const { maxLicenses, maxWeights } = setBestFitLicenses(
      table,
      licenseCandidates
    );

    const bestFitPaths = setBestFitPaths(
      table,
      LINKED_TABLE_LOOKUP[table].licenseMap,
      maxLicenses
    );

    LINKED_TABLE_LOOKUP[table].maxLicenses = maxLicenses;
    LINKED_TABLE_LOOKUP[table].maxWeights = maxWeights;
    LINKED_TABLE_LOOKUP[table].bestFitPaths = bestFitPaths;
  }
}

function handleExclusionList() {
  for (const table of CUSTOM_TABLE_NAMES) {
    if (KNOWN_STORE_TABLES[table] || KNOWN_OOTB_TABLES[table]) {
      TABLE_LICENSE_LOOKUP[table] = [RecommenderConstants.EXCLUDED];
      TABLE_LICENSE_REASON_LOOKUP[table] = [
        [RecommenderConstants.REASONS.EXCLUDED]
      ];
      TABLE_LICENSE_WEIGHT_LOOKUP[table] = null;
      TABLE_LICENSE_PATH_LOOKUP[table] = null;
    }
  }
}

function roughSizeOfObject(object) {
  const objectSeen = new Set();
  const stack = [object];
  let bytes = 0;

  while (stack.length) {
    let value = stack.pop();

    if (typeof value === "boolean") {
      bytes += 4;
    } else if (typeof value === "string") {
      bytes += value.length * 2;
    } else if (typeof value === "number") {
      bytes += 8;
    } else if (typeof value === "object" && !objectSeen.has(value)) {
      objectSeen.add(value);

      for (let i in value) {
        stack.push(value[i]);
      }
    }
  }
  return bytes;
}

function calculateStats(calculatedData) {
  STATS.maxTables = CUSTOM_TABLE_NAMES.length;
  ALL_STATS.maxTables = Math.max(
    ALL_STATS.maxTables,
    CUSTOM_TABLE_NAMES.length
  );

  const maxObjectSize = Math.max(
    roughSizeOfObject(calculatedData),
    roughSizeOfObject(LINKED_TABLE_LOOKUP)
  );
  STATS.maxObjectSize = maxObjectSize;
  ALL_STATS.maxObjectSize = Math.max(ALL_STATS.maxObjectSize, maxObjectSize);

  for (const table of CUSTOM_TABLE_NAMES) {
    STATS.maxLicenseNum = Math.max(
      STATS.maxLicenseNum,
      TABLE_LICENSE_LOOKUP[table].length
    );
    ALL_STATS.maxLicenseNum = Math.max(
      ALL_STATS.maxLicenseNum,
      TABLE_LICENSE_LOOKUP[table].length
    );

    STATS.total++;
    ALL_STATS.total++;

    if (TABLE_LICENSE_LOOKUP[table][0] === RecommenderConstants.EXCLUDED) {
      STATS.excluded++;
      ALL_STATS.excluded++;
      continue;
    }

    const { assignedLicense } = DATA[table];
    const weights = TABLE_LICENSE_WEIGHT_LOOKUP[table];

    if (!assignedLicense) {
      STATS.nullLicense++;
      ALL_STATS.nullLicense++;

      for (let i = 0; i < TABLE_LICENSE_LOOKUP[table].length; i++) {
        const license = TABLE_LICENSE_LOOKUP[table][i];

        if (license === RecommenderConstants.FALLBACK_LICENSE) {
          STATS.recommendations[i].appEngine++;
          ALL_STATS.recommendations[i].appEngine++;
        } else {
          STATS.recommendations[i].OOTBLicense++;
          ALL_STATS.recommendations[i].OOTBLicense++;
        }
        ALL_STATS.recommendations[i].licenseCounts[license] =
          (ALL_STATS.recommendations[i].licenseCounts[license] || 0) + 1;
        STATS.recommendations[i].licenseCounts[license] =
          (STATS.recommendations[i].licenseCounts[license] || 0) + 1;

        STATS.recommendations[i].weights[weights[i]] =
          (STATS.recommendations[i].weights[weights[i]] || 0) + 1;
        ALL_STATS.recommendations[i].weights[weights[i]] =
          (ALL_STATS.recommendations[i].weights[weights[i]] || 0) + 1;
      }
    } else {
      STATS.hasLicence++;
      ALL_STATS.hasLicence++;
    }
  }

  for (let i = 0; i < RecommenderConstants.NUM_RECOMMENDATIONS; i++) {
    const appEngine = STATS.recommendations[i].appEngine;
    const OOTBLicense = STATS.recommendations[i].OOTBLicense;
    const total = appEngine + OOTBLicense;

    STATS.recommendations[i].same = ((appEngine / total) * 100).toFixed(2);
    STATS.recommendations[i].different = ((OOTBLicense / total) * 100).toFixed(
      2
    );
  }
}

// TODO PERF: This should be getReasonText for performance improvements.
function setReasonText() {
  for (let table of CUSTOM_TABLE_NAMES) {
    const allReasons = TABLE_LICENSE_REASON_LOOKUP[table];
    const allPaths = TABLE_LICENSE_PATH_LOOKUP[table];
    TABLE_LICENSE_REASON_TEXT_LOOKUP[table] = Array(allReasons.length)
      .fill(null)
      .map(() => []);

    for (let i = 0; i < allReasons.length; i++) {
      let reasonObj = {
        main: "",
        details: {}
      };

      for (let j = 0; j < allReasons[i].length; j++) {
        let reason = allReasons[i][j];
        if (reason === RecommenderConstants.REASONS.ASSIGNMENT) {
          // Table has an assigned license
          reasonObj.main = gs.getMessage(
            "The customer already assigned a license to this table."
          );
        } else if (reason === RecommenderConstants.REASONS.DEFAULT) {
          // No licenses were available in the graph, so we have defaulted to App Engine
          reasonObj.main = gs.getMessage(
            "Custom tables that are not associated with other licensed applications should use the App Engine license. We did not find a relationship from this table to other licensed objects or applications. As a result we recommend using the App Engine Standalone license."
          );
        } else if (reason === RecommenderConstants.REASONS.SUBSCRIPTION) {
          // No licenses were available in the graph, so we have defaulted to App Engine
          reasonObj.main = gs.getMessage(
            "The table is in a scope or package with the recommended license."
          );
        } else if (reason === RecommenderConstants.REASONS.EXCLUDED) {
          // This is an excluded table
          reasonObj.main = gs.getMessage(
            "This table was found in the Custom Table Inventory (ua_custom_table_inventory) but does not appear to be customer created. The customer does not need to assign a license to this table because it was created by ServiceNow, created by a vendor on the customer's behalf, or for another similar reason. The customer should delete this entry from the Custom Table Inventory."
          );
        } else if (reason === RecommenderConstants.REASONS.EXTENDS) {
          // The custom table extends a table with the required license
          const path = allPaths[i][j];
          const extendingTable = path[path.length - 1];
          reasonObj.main = gs.getMessage(
            "This table extends table ({0}) that has the recommended license.",
            extendingTable
          );
        } else {
          // The license for the table came from one of the relations
          const paths = allPaths[i];

          let pathMap = {};
          for (let k = 0; k < paths.length; k++) {
            const arrowPath = paths[k].join(" -> ");
            if (!(arrowPath in pathMap)) {
              pathMap[arrowPath] = k;
            }
          }

          let pathMapKeys = Object.keys(pathMap);

          reasonObj.main = gs.getMessage(
            "We recommend this license based on {0} relationship chain(s) for this table.",
            pathMapKeys.length
          );

          for (let i = 0; i < pathMapKeys.length; i++) {
            let idx = pathMap[pathMapKeys[i]];
            const arrowPath = pathMapKeys[i];
            const lastTable = paths[idx][paths[idx].length - 1];
            if (reason === RecommenderConstants.REASONS.RELATION_OOTB) {
              // Table got the license from a Servicenow Table
              reasonObj.details[i + 1] = gs.getMessage(
                "This table is related to an out-of-the-box ServiceNow table ({0}) that has this license through the following path : {1}",
                lastTable,
                arrowPath
              );
            } else {
              // Table got the license from a Custom Table
              reasonObj.details[i + 1] = gs.getMessage(
                "This table is related to a table defined by the customer ({0}) that has this license through the following path : {1}",
                lastTable,
                arrowPath
              );
            }
          }
        }
      }

      TABLE_LICENSE_REASON_TEXT_LOOKUP[table][i] = reasonObj;
    }

    delete TABLE_LICENSE_PATH_LOOKUP[table];
    delete TABLE_LICENSE_REASON_LOOKUP[table];
  }
}

function mergeData() {
  let result = {};
  for (let table of CUSTOM_TABLE_NAMES) {
    result[table] = {};
    result[table].licenses = TABLE_LICENSE_LOOKUP[table];
    result[table].weights = TABLE_LICENSE_WEIGHT_LOOKUP[table];
    // result[table].paths = TABLE_LICENSE_PATH_LOOKUP[table];
    // result[table].reasons = TABLE_LICENSE_REASON_LOOKUP[table];
    // result[table].reasonTexts = TABLE_LICENSE_REASON_TEXT_LOOKUP[table];
  }

  return result;
}

// Adds a table to the entry if it's missing.
// Adds a license to the entry if it's missing.
// This will do nothing if IA returns all the required data correctly.
function handleMissingServiceNowData(processedData) {
  for (let table of Object.keys(processedData)) {
    const { relatedLicensesAndTables } = processedData[table];
    for (let rl of relatedLicensesAndTables) {
      if ("license" in rl && !rl.license) {
        // license key exists without a value
        rl.license = RecommenderConstants.MISSING_SUBSCRIPTION_NAME;
        rl.table = RecommenderConstants.MISSING_SERVICENOW_TABLE;
      } else if ("license" in rl && rl.license && !rl.table) {
        // table is not set correctly. Either the key is missing
        // or the table is empty.
        rl.table = RecommenderConstants.MISSING_SERVICENOW_TABLE;
      }
    }
  }
}

function calculateLicenses(processedData, fileName = "") {
  // Resets all global variables
  resetGlobalVariables(fileName);

  // Hack the missing data for now, ideally this function should do nothing.
  handleMissingServiceNowData(processedData);

  // Set the data on the global object, so that we don't have to pass it everywhere
  DATA = processedData;
  Object.freeze(DATA);

  // Set the table names globally so that all functions can use them
  CUSTOM_TABLE_NAMES = Object.freeze(Object.keys(DATA));

  // Set licenses for tables where we have assigned licenses.
  handleAssignedLicenses();

  // Set licenses for tables where we have strong conviction
  // Currently limited to assignments, subscription and extensions
  handleStrongRelations();

  // Sets up LINKED_TABLE_LOOKUP lookup
  setupLinkedTablesLookup();

  // Find best fit licenses where we do not have strong relation
  handleWeakRelations();

  setBestFitLicensesAndPaths();

  handleExclusionList();

  setReasonText();

  const calculatedData = mergeData();

  // Code related to stats, do not add to SM codebase.
  calculateStats(calculatedData);

  // const numKeys = [
  //   Object.keys(TABLE_LICENSE_LOOKUP).length,
  //   Object.keys(TABLE_LICENSE_REASON_LOOKUP).length,
  //   Object.keys(TABLE_LICENSE_PATH_LOOKUP).length,
  //   Object.keys(TABLE_LICENSE_WEIGHT_LOOKUP).length
  // ];
  //
  // if (!numKeys.every((v) => v === numKeys[0])) {
  //   console.error(`Key mismatch`, numKeys);
  // }
  //
  // for (let table of Object.keys(TABLE_LICENSE_PATH_LOOKUP)) {
  //   let paths = TABLE_LICENSE_PATH_LOOKUP[table];
  //   let reasons = TABLE_LICENSE_REASON_LOOKUP[table];
  //
  //   if (paths === null) {
  //     // excluded
  //     continue;
  //   }
  //
  //   if (Object.keys(paths).length !== Object.keys(reasons).length) {
  //     console.error(`outer mismatch`, table);
  //     console.log(
  //       paths,
  //       reasons,
  //       paths,
  //       reasons,
  //       Object.keys(paths).length,
  //       Object.keys(reasons).length
  //     );
  //   }
  //
  //   for (let i = 0; i < paths.length; i++) {
  //     if (Object.keys(paths[i]).length === 0) {
  //       if (Object.keys(reasons[i]).length !== 1) {
  //         console.error(`default mismatch reasons`, table);
  //         // console.log(paths[i], reasons[i], paths, reasons,Object.keys(paths[i]).length , Object.keys(reasons[i]).length)
  //       }
  //     } else if (
  //       Object.keys(paths[i]).length !== Object.keys(reasons[i]).length
  //     ) {
  //       console.error(`non-default mismatch reasons`, table);
  //       // console.log(paths[i], reasons[i], paths, reasons,Object.keys(paths[i]).length , Object.keys(reasons[i]).length)
  //     }
  //   }
  // }
  //
  // for (let table of Object.keys(TABLE_LICENSE_LOOKUP)) {
  //   let licenses = TABLE_LICENSE_LOOKUP[table];
  //   let weights = TABLE_LICENSE_WEIGHT_LOOKUP[table];
  //   let paths = TABLE_LICENSE_PATH_LOOKUP[table];
  //   let reasonTexts = TABLE_LICENSE_REASON_TEXT_LOOKUP[table];
  //
  //   if (paths === null) {
  //     // excluded
  //     continue;
  //   }
  //
  //   if (Object.keys(licenses).length !== Object.keys(weights).length) {
  //     console.error(`outer mismatch weights`, table);
  //   }
  //
  //   if (Object.keys(licenses).length !== Object.keys(reasonTexts).length) {
  //     console.error(`outer mismatch reasonTexts`, table);
  //   }
  // }

  return {
    CALCULATED_DATA: calculatedData,
    NUM_RECOMMENDATIONS: RecommenderConstants.NUM_RECOMMENDATIONS,
    STATS,
    ALL_STATS
  };
}

// const fn = "hestiadev_processed.json";
// const tempData = require("./farm_scans/output/" + fn);
// calculateLicenses(tempData, fn);

module.exports = {
  calculateLicenses,
  HEURISTICS: RecommenderConstants.RELATION_DETAILS,
  FALLBACK_LICENSE: RecommenderConstants.FALLBACK_LICENSE
};