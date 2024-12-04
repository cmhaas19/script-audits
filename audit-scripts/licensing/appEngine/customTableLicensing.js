var START_TIMER = new GlideDateTime();
var MODULE_TIMER = new GlideDateTime();

var TIMERS = [];
var TABLE_TIMES = [];

var VERSION_MAPPER = {
  SM_VERSION: null,
  LICENSE_TABLE: null,
  LICENSE_TO_FAMILY_TABLE: null,
  LICENSE_REFERENCE_COLUMN: null,
  LICENSE_TO_FAMILY_REFERENCE_COLUMN: null,
  APPLICATION_ENTITLEMENT_REFERENCE_COLUMN: null,
  CUSTOM_TABLE_LICENSE_REFERENCE_COLUMN: null,
};

/*
    Mapping of License sources to codes
*/
var LICENSE_SOURCE_CODES = {
  sub: 1, // subscription field
  ext: 2, // extension
  ref: 3, // referring field
  refnc: 4, // reference field
  relTo: 5, // relationship to
  relFrom: 6, // relationship from
  flowAct: 7, // flow action
  flowTrig: 8, // flow is trigger
};

var ENTITLEMENT_TO_SUBSCRIPTION_NAME_MAP = null;
var IS_VS2 = null;

function getTimeDiff(startTime) {
  return (
    GlideDateTime.subtract(startTime, new GlideDateTime()).getNumericValue() /
    1000
  );
}
function addModuleTimer(eventName) {
  if (eventName) {
    TIMERS.push({
      time: getTimeDiff(MODULE_TIMER),
      name: eventName,
    });
  }
  MODULE_TIMER = new GlideDateTime();
}

function addTableTimer(tableTimer) {
  TABLE_TIMES.push(getTimeDiff(tableTimer));
}

/**
 * Used to replace long, repetitive strings in the output JSON of this read
 * audit with short numbers. This is important for running read audits which have
 * a maximum string size they can return. For example, long license names that
 * appear many times in the output like this:
 *
 * ```
 * {
 *   licenses: [
 *     {"license": "IT Service Management Standard - Fulfiller User v2"},
 *     {"license": "App Engine - Fulfiller  "},
 *     {"license": "IT Service Management Standard - Fulfiller User v2"},
 *   ]
 * }
 * ```
 *
 * Can be replaced with a short integer like this:
 *
 * ```
 * {
 *   licenses: [
 *     {"license": 0},
 *     {"license": 1},
 *     {"license": -}
 *   ]
 * }
 * ```
 *
 * When the result is printed as JSON call `getMap()` to print the lookup
 * map that you can decode later:
 *
 * ```
 * {
 *   licenses: [
 *     {"license": 0},
 *     {"license": 1},
 *     {"license": -}
 *   ],
 *   licenseMap: {
 *     "IT Service Management Standard - Fulfiller User v2':0,'($0 ACV) Grandfathered Custom Tables - Custom Tables": 0,
 *     "App Engine - Fulfiller  ": 1
 *   }
 * }
 * ```
 */
function createStringMap() {
  var strToInt = {};
  var currentOffset = 0;

  /**
   * Used to replace long, repetitive strings in the output JSON of this read
   * audit with short numbers. Each time a string is encountered it can be
   * exchanged for an integer shortcode by calling `add(string)`
   * @param {string} str
   * @returns {number}
   */
  function add(str) {
    if (!str) return null;
    if (strToInt[str] === undefined) {
      strToInt[str] = currentOffset;
      currentOffset++;
    }
    return strToInt[str];
  }

  /**
   * Returns the map so you can translate back from numbers to strings.
   * @returns {{[string]: number}}
   */
  function getMap() {
    return strToInt;
  }

  return {
    add: add,
    getMap: getMap,
  };
}
var licenseMap = createStringMap();

/**
 * Sets license tables based on subscription monitoring sys_properties.
 * To find out the currently active licensing version, we use two sys_properties
 * 'glide.entitlement.ems.data.available' (emsData) and 'glide.entitlement.surf_routing' (surfRouting).
 * These are the states which subscription plugins go through:
 * emsData = false & surfRouting = true -> Licensing V1 tables is the source of truth.
 * emsData = false & surfRouting = false-> Invalid state, no tables are guaranteed to be the source of truth
 * emsData = true & surfRouting = false -> Licensing V2  is the source of truth.
 * emsData = true & surfRouting = true -> Migration from V1 to V2 is active. Licensing V1 tables are
 * accepted as the source of truth till migration has completed
 */
function setLookupTablesBasedOnVersion() {
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

  IS_VS2 = !isSurfRouting && isEMSDataAvailable;

  if (IS_VS2) {
    ENTITLEMENT_TO_SUBSCRIPTION_NAME_MAP =
      getEntitlementToSubscriptionNameMap();
    VERSION_MAPPER = {
      SM_VERSION: 2,
      LICENSE_TABLE: "subscription_entitlement",
      LICENSE_TO_FAMILY_TABLE: "subscription_has_family",
      LICENSE_REFERENCE_COLUMN: "entitlement_id",
      LICENSE_TO_FAMILY_REFERENCE_COLUMN: "subscription",
      APPLICATION_ENTITLEMENT_REFERENCE_COLUMN: "subscription_family",
      CUSTOM_TABLE_LICENSE_REFERENCE_COLUMN: "subscription_entitlement",
    };
  } else {
    VERSION_MAPPER = {
      SM_VERSION: 1,
      LICENSE_TABLE: "license_details",
      LICENSE_TO_FAMILY_TABLE: "license_has_family",
      LICENSE_REFERENCE_COLUMN: "sys_id",
      LICENSE_TO_FAMILY_REFERENCE_COLUMN: "license",
      APPLICATION_ENTITLEMENT_REFERENCE_COLUMN: "license_family",
      CUSTOM_TABLE_LICENSE_REFERENCE_COLUMN: "license",
    };
  }
}

function getEntitlementToSubscriptionNameMap() {
  var entIdToSubscriptionIdMap = {};
  var gr = new GlideRecord("license_cust_table_allotment");
  gr.addNotNullQuery("subscription_entitlement");
  gr.setWorkflow(false);
  gr.query();

  var entitlementId = "subscription_entitlement" + "." + "entitlement_id";
  while (gr.next())
    entIdToSubscriptionIdMap[gr.getElement(entitlementId)] = gr.getDisplayValue(
      "subscription_entitlement"
    );

  return entIdToSubscriptionIdMap;
}

function getLicenseCodeVS1(subscriptionGR) {
  var licenseCode = licenseMap.add(subscriptionGR.getValue("name"));
  return licenseCode;
}
function getLicenseCodeVS2(subscriptionGR) {
  // If we find a subscription that is not entitlement_type Primary Subscription with a value of '0', we will use the primaryEntitlementToSubscriptionNameMap to find the name of it's
  // parent subscription_entitlement.
  var entitlementType = subscriptionGR.getValue("entitlement_type");
  var licenseCode = null;
  if (entitlementType !== "0") {
    var parentEntitlementId = subscriptionGR.getValue("parent_entitlement_id");
    licenseCode = licenseMap.add(
      ENTITLEMENT_TO_SUBSCRIPTION_NAME_MAP[parentEntitlementId]
    );
  } else {
    licenseCode = licenseMap.add(subscriptionGR.getValue("name"));
  }

  return licenseCode;
}

function createLicenseFinder() {
  var cacheByLineageId = {};
  function byLineageId(lineageId) {
    if (cacheByLineageId.hasOwnProperty(lineageId)) {
      return cacheByLineageId[lineageId];
    }

    var subscriptionGR = new GlideRecord(VERSION_MAPPER.LICENSE_TABLE);

    // Always run this before the join query
    if (!IS_VS2) {
      subscriptionGR.addQuery("table_count", ">", "0");
    }

    var jq = subscriptionGR.addJoinQuery(
      VERSION_MAPPER.LICENSE_TO_FAMILY_TABLE,
      VERSION_MAPPER.LICENSE_REFERENCE_COLUMN,
      VERSION_MAPPER.LICENSE_TO_FAMILY_REFERENCE_COLUMN
    );

    var applicationEntitlementQuery =
      VERSION_MAPPER.APPLICATION_ENTITLEMENT_REFERENCE_COLUMN + ".family_id";
    jq.addCondition(applicationEntitlementQuery, lineageId);

    subscriptionGR.query();

    if (!subscriptionGR.next()) {
      cacheByLineageId[lineageId] = null;
      return null;
    }

    if (IS_VS2) {
      cacheByLineageId[lineageId] = getLicenseCodeVS2(subscriptionGR);
    } else {
      cacheByLineageId[lineageId] = getLicenseCodeVS1(subscriptionGR);
    }

    return cacheByLineageId[lineageId];
  }

  var cacheByPackageId = {};
  function byPackageId(packageId) {
    if (cacheByPackageId[packageId]) return cacheByPackageId[packageId];
    var results = [];
    var packageIdCom = "com." + packageId;
    var packageIdComSnc = "com.snc." + packageId;
    var uaAppFamilyGR = new GlideRecord("ua_app_family");
    uaAppFamilyGR
      .addQuery("app_id", packageId)
      .addOrCondition("app_id", packageIdCom)
      .addOrCondition("app_id", packageIdComSnc);
    uaAppFamilyGR.setWorkflow(false);
    uaAppFamilyGR.query();
    while (uaAppFamilyGR.next()) {
      // var appId = familyGr.getValue("app_id");
      // var scope = familyGr.getValue("scope");
      var lineageId = uaAppFamilyGR.getValue("lineage_id");
      var licenseCode = byLineageId(lineageId);
      if (licenseCode !== null) {
        results.push(licenseCode);
      }
    }
    cacheByPackageId[packageId] = results;
    return results;
  }

  var cacheByScopeId = {};
  function byScopeId(scopeId) {
    if (cacheByScopeId[scopeId]) return cacheByScopeId[scopeId];
    var results = [];
    var uaAppFamilyGR = new GlideRecord("ua_app_family");
    uaAppFamilyGR.addQuery("scope", scopeId);
    uaAppFamilyGR.setWorkflow(false);
    uaAppFamilyGR.query();
    while (uaAppFamilyGR.next()) {
      // var appId = familyGr.getValue("app_id");
      // var scope = familyGr.getValue("scope");
      var lineageId = uaAppFamilyGR.getValue("lineage_id");
      var licenseCode = byLineageId(lineageId);
      if (licenseCode !== null) {
        results.push(licenseCode);
      }
    }
    cacheByScopeId[scopeId] = results;
    return results;
  }

  var cacheByTableName = {};
  /**
   * Given a table name (sys_db_object.name) finds any applicable licenses
   * for this table. Licenses are found by the following logic:
   *
   * 1. Find the package (sys_package) and application (sys_app) the table
   *    is defined in. One or both of these may be undefined.
   * 2. Find any ua_app_family records referencing the package ID
   *    (sys_package.source) or scope ID (sys_scope.scope), taking into
   *    consideration that the package ID may be in many formats.
   * 3. Walk from the ua_app_family records to the license for product
   *    family on this customer instance.
   *
   * Note that some internal and demo instances will not have ua_app_family
   * populated, and most internal instances will not have the license details
   * tables popualated (license_has_family, license_details, etc.)
   *
   * @param {string} tableName
   * @returns {number[]} - License shortcodes that can be translated by inspecting `licenseMap.getMap()`
   */
  function byTableName(tableName) {
    if (cacheByTableName[tableName]) return cacheByTableName[tableName];
    var sysDbObjectGR = new GlideRecord("sys_db_object");
    sysDbObjectGR.setLimit(1);
    sysDbObjectGR.addQuery("name", tableName);
    sysDbObjectGR.setWorkflow(false);
    sysDbObjectGR.query();
    if (!sysDbObjectGR.hasNext()) {
      return [];
    }
    sysDbObjectGR.next();
    var result = [];
    var packageId =
      sysDbObjectGR.getValue("sys_package") !== null
        ? sysDbObjectGR.sys_package.source.toString()
        : null;
    var scopeId =
      sysDbObjectGR.getValue("sys_scope") !== null
        ? sysDbObjectGR.sys_scope.scope.toString()
        : null;
    if (packageId !== null) {
      result = result.concat(byPackageId(packageId));
    }
    if (scopeId !== null && scopeId !== "global") {
      result = result.concat(byScopeId(scopeId));
    }
    cacheByTableName[tableName] = result;
    return result;
  }

  return {
    byTableName: byTableName,
  };
}
var licenseFinder = createLicenseFinder();

/*  
    Get a list of custom tables on the instance
*/
function getCustomTables() {
  var customTables = {};
  var cti = new GlideRecord("ua_custom_table_inventory");
  cti.query();
  while (cti.next()) {
    var tableName = cti.getValue("table_name");
    var tableHierarchy = new TableUtils(tableName);
    var path = j2js(tableHierarchy.getTables()).slice(1);

    customTables[tableName] = {
      p: path,
      l: licenseMap.add(
        cti.getDisplayValue(
          VERSION_MAPPER.CUSTOM_TABLE_LICENSE_REFERENCE_COLUMN
        )
      ),
      r: [],
    };
  }

  return customTables;
}

/* 
    Get all tables which extend another table
*/
function getExtendedTables() {
  var encodedQuery = "super_classISNOTEMPTY";
  var sysDbObjectGR = new GlideRecord("sys_db_object");
  sysDbObjectGR.addEncodedQuery(encodedQuery);
  sysDbObjectGR.setWorkflow(false);
  sysDbObjectGR.query();

  var table = {};
  while (sysDbObjectGR.next()) {
    table[sysDbObjectGR.getValue("name")] =
      sysDbObjectGR.super_class.name.toString();
  }

  return table;
}

/*  
    Get all tables which reference this table
    table : string - table name - must correspond to the sys_dictionary.name field
*/
function getReferringTables(tableName) {
  var encodedQuery = "internal_type=reference^reference.name=" + tableName;
  var sysDictionaryGR = new GlideAggregate("sys_dictionary");
  sysDictionaryGR.addEncodedQuery(encodedQuery);
  sysDictionaryGR.addAggregate("GROUP_CONCAT_DISTINCT", "name");
  sysDictionaryGR.setWorkflow(false);
  sysDictionaryGR.groupBy("reference.name");
  sysDictionaryGR.query();

  var tables = [];
  if (sysDictionaryGR.next())
    tables = sysDictionaryGR
      .getAggregate("GROUP_CONCAT_DISTINCT", "name")
      .split(",");

  return tables;
}

/*
    Get all tables referenced by this table
    table.reference => u_reference
*/
function getTablesReferenced(tableName) {
  var encodedQuery = "name=" + tableName + "^internal_type=reference";

  var sysDictionaryGR = new GlideAggregate("sys_dictionary");
  sysDictionaryGR.addEncodedQuery(encodedQuery);
  sysDictionaryGR.addAggregate("GROUP_CONCAT_DISTINCT", "reference.name");
  sysDictionaryGR.setWorkflow(false);
  sysDictionaryGR.groupBy("name");
  sysDictionaryGR.query();

  var tables = [];
  if (sysDictionaryGR.next())
    tables = sysDictionaryGR
      .getAggregate("GROUP_CONCAT_DISTINCT", "reference.name")
      .split(",");

  return tables;
}

/*  
    Get a list of tables from the basic_query_from field in the Relationships (sys_relationship) table
    where the passed in tableName is the basic_apply_to value
    "applies to -> custom table" is similar to getReferringTables
*/
function getQueryFromAppliesTo(tableName) {
  var encodedQuery =
    "basic_apply_toNSAMEASbasic_query_from^basic_apply_to=" + tableName;

  var sysRelationshipGR = new GlideAggregate("sys_relationship");
  sysRelationshipGR.addEncodedQuery(encodedQuery);
  sysRelationshipGR.addAggregate("GROUP_CONCAT_DISTINCT", "basic_query_from");
  sysRelationshipGR.setWorkflow(false);
  sysRelationshipGR.groupBy("basic_apply_to");
  sysRelationshipGR.query();

  var tables = [];
  if (sysRelationshipGR.next())
    tables = sysRelationshipGR
      .getAggregate("GROUP_CONCAT_DISTINCT", "basic_query_from")
      .split(",");

  return tables;
}

/*  
    Get a list of tables from the basic_apply_to field in the Relationships (sys_relationship) table
    where the passed in tableName is the basic_query_from value
    "query from -> custom table" is similar to getTablesReferenced
*/
function getAppliesFromQueryFrom(tableName) {
  var encodedQuery =
    "basic_apply_toNSAMEASbasic_query_from^basic_query_from=" + tableName;

  var sysRelationshipGR = new GlideAggregate("sys_relationship");
  sysRelationshipGR.addEncodedQuery(encodedQuery);
  sysRelationshipGR.addAggregate("GROUP_CONCAT_DISTINCT", "basic_apply_to");
  sysRelationshipGR.setWorkflow(false);
  sysRelationshipGR.groupBy("basic_query_from");
  sysRelationshipGR.query();

  var tables = [];
  if (sysRelationshipGR.next())
    tables = sysRelationshipGR
      .getAggregate("GROUP_CONCAT_DISTINCT", "basic_apply_to")
      .split(",");

  return tables;
}

function getTableSubscription(
  tableName,
  source,
  customTables,
  nonCustomTables,
  licences
) {
  // if it is a custom table, just return the
  if (customTables[tableName]) {
    licences.push({ t: tableName, s: source });
    return licences;
  }

  if (!nonCustomTables[tableName]) {
    nonCustomTables[tableName] = licenseFinder.byTableName(tableName);
  }

  for (var i = 0; i < nonCustomTables[tableName].length; i++) {
    licences.push({
      t: tableName,
      l: nonCustomTables[tableName][i],
      s: source,
    });
  }

  return licences;
}

/*  
    Gets all table subscriptions for table and from related tables 
*/
function getCustomTableLicenses(
  tableName,
  extendedTables,
  allFlows,
  customTables,
  nonCustomTables
) {
  var i = 0;
  var subscriptions = licenseFinder.byTableName(tableName);
  var licences = subscriptions.map(function (l) {
    return { t: tableName, l: l, s: LICENSE_SOURCE_CODES.sub };
  });

  // find extension
  var extendedTableName = extendedTables[tableName];
  if (extendedTableName) {
    licences = getTableSubscription(
      extendedTableName,
      LICENSE_SOURCE_CODES.ext,
      customTables,
      nonCustomTables,
      licences
    );
  }

  // find out if anyone is referring to it
  var referringTables = getReferringTables(tableName);
  for (i = 0; i < referringTables.length; i++) {
    licences = getTableSubscription(
      referringTables[i],
      LICENSE_SOURCE_CODES.ref,
      customTables,
      nonCustomTables,
      licences
    );
  }

  // find out if it is referencing anyone
  var tablesReferenced = getTablesReferenced(tableName);
  for (i = 0; i < tablesReferenced.length; i++) {
    licences = getTableSubscription(
      tablesReferenced[i],
      LICENSE_SOURCE_CODES.refnc,
      customTables,
      nonCustomTables,
      licences
    );
  }

  // find out if it is in a relationship TO
  var tablesRelationshipTo = getQueryFromAppliesTo(tableName);
  for (i = 0; i < tablesRelationshipTo.length; i++) {
    licences = getTableSubscription(
      tablesRelationshipTo[i],
      LICENSE_SOURCE_CODES.relTo,
      customTables,
      nonCustomTables,
      licences
    );
  }

  // find out if it is in a relationship FROM
  var tablesRelationshipFrom = getAppliesFromQueryFrom(tableName);
  for (i = 0; i < tablesRelationshipFrom.length; i++) {
    licences = getTableSubscription(
      tablesRelationshipFrom[i],
      LICENSE_SOURCE_CODES.relFrom,
      customTables,
      nonCustomTables,
      licences
    );
  }

  var tablesTriggerFlow = getTableTriggerFlow(tableName, allFlows);
  for (i = 0; i < tablesTriggerFlow.length; i++) {
    licences = getTableSubscription(
      tablesTriggerFlow[i],
      LICENSE_SOURCE_CODES.flowTrig,
      customTables,
      nonCustomTables,
      licences
    );
  }

  var tablesActionFlow = getTableActionFlow(tableName, allFlows);
  for (i = 0; i < tablesActionFlow.length; i++) {
    licences = getTableSubscription(
      tablesActionFlow[i],
      LICENSE_SOURCE_CODES.flowAct,
      customTables,
      nonCustomTables,
      licences
    );
  }

  return licences;
}

function getAllFlows() {
  var sysVariableValueGR = new GlideAggregate("sys_variable_value");
  sysVariableValueGR.setWorkflow(false);
  // TODO David Leonard thinks that a flow can trigger an action to another flow which can trigger an action on a table
  // so we need to investigate, add in flows as internal type, and track them in a third obj
  sysVariableValueGR.addEncodedQuery(
    "document=sys_hub_action_instance^ORdocument=sys_hub_trigger_instance^variable.internal_type.name=table_name"
  );

  sysVariableValueGR.addAggregate("GROUP_CONCAT_DISTINCT", "document_key");

  sysVariableValueGR.groupBy("document");
  sysVariableValueGR.groupBy("value");

  sysVariableValueGR.query();

  var allFlows = {
    flows_by_table_through_instance: {},
    tables_by_flow_through_instance: {},
  };

  while (sysVariableValueGR.next()) {
    var instance = sysVariableValueGR.getValue("document");
    var table = sysVariableValueGR.getValue("value");
    var documentKeys = sysVariableValueGR
      .getAggregate("GROUP_CONCAT_DISTINCT", "document_key")
      .split(",");

    if (!table) continue;
    // sets allFlows via ref
    setFlowsAndTableThroughInstance(allFlows, instance, documentKeys, table);
  }

  return allFlows;
}

function setFlowsAndTableThroughInstance(
  allFlows,
  instance,
  documentKeys,
  table
) {
  if (!allFlows.flows_by_table_through_instance[table]) {
    allFlows.flows_by_table_through_instance[table] = {
      sys_hub_action_instance: [],
      sys_hub_trigger_instance: [],
    };
  }

  var block = new GlideRecord(instance);
  var processedFlow = {};

  for (var i = 0; i < documentKeys.length; i++) {
    var document_key = documentKeys[i];

    if (document_key === "") continue;

    if (block.get(document_key)) {
      var flow = block.getValue("flow");
      // need to check for dups
      if (processedFlow[flow]) continue;

      if (!allFlows.tables_by_flow_through_instance[flow]) {
        allFlows.tables_by_flow_through_instance[flow] = {
          sys_hub_action_instance: [],
          sys_hub_trigger_instance: [],
        };
      }

      processedFlow[flow] = true;
      allFlows.flows_by_table_through_instance[table][instance].push(flow);
      allFlows.tables_by_flow_through_instance[flow][instance].push(table);
    }
  }
}

function getTableTriggerFlow(tableName, allFlows) {
  if (!allFlows.flows_by_table_through_instance[tableName]) return [];

  var flows =
    allFlows.flows_by_table_through_instance[tableName][
      "sys_hub_trigger_instance"
    ];

  var tables = [];
  for (var i = 0; i < flows.length; i++) {
    // if (!triggerTypeIsCRU(flows[i])) continue;
    var actions =
      allFlows.tables_by_flow_through_instance[flows[i]][
        "sys_hub_action_instance"
      ];
    // appends onto tables by ref
    filterAndConcat(tableName, tables, actions);
  }

  return tables;
}

function getTableActionFlow(tableName, allFlows) {
  if (!allFlows.flows_by_table_through_instance[tableName]) return [];

  var flows =
    allFlows.flows_by_table_through_instance[tableName][
      "sys_hub_action_instance"
    ];

  var tables = [];
  for (var i = 0; i < flows.length; i++) {
    // if (!triggerTypeIsCRU(flows[i])) continue;
    var trigger =
      allFlows.tables_by_flow_through_instance[flows[i]][
        "sys_hub_trigger_instance"
      ];
    // appends onto tables by ref
    filterAndConcat(tableName, tables, trigger);
  }

  return tables;
}

/*
    Although there are other types of triggers on our clone, such as email, daily, service_catalog
    These dont seem to change the end result and just processing them unnessarily is faster than querying the table
    Leaving the calls to this fn commented out in case we sort out a smarter way
*/
function triggerTypeIsCRU(flow) {
  var triggers = new GlideRecord("sys_hub_trigger_instance");
  triggers.setWorkflow(false);

  if (!triggers.get("flow", flow)) return false;

  var type = triggers.getValue("trigger_type");
  return (
    type == "record_create" ||
    type == "record_create_or_update" ||
    type == "record_update"
  );
}

function filterAndConcat(tableName, tables, newTables) {
  for (var i = 0; i < newTables.length; i++) {
    if (newTables[i] === tableName) continue;
    tables.push(newTables[i]);
  }
}

function main() {
  setLookupTablesBasedOnVersion();

  addModuleTimer("preprocessing");

  var customTables = getCustomTables();
  var tableNames = Object.keys(customTables);

  addModuleTimer("getCustomTables");
  var extendedTables = getExtendedTables();

  addModuleTimer("getExtendedTables");
  var allFlows = getAllFlows();

  addModuleTimer("getAllFlows");
  var nonCustomTables = [];

  for (var i = 0; i < tableNames.length; i++) {
    var tableTimer = new GlideDateTime();

    var tableName = tableNames[i];
    var license = getCustomTableLicenses(
      tableName,
      extendedTables,
      allFlows,
      customTables,
      nonCustomTables
    );

    customTables[tableName].r = license;

    addTableTimer(tableTimer);
  }

  var result = {
    v: VERSION_MAPPER.SM_VERSION,
    l: licenseMap.getMap(),
    tc: Object.keys(customTables).length,
    t: customTables,
    log: {
      timers: TIMERS,
      scriptTime: getTimeDiff(START_TIMER),
      tableTime: {
        max: Math.max.apply(null, TABLE_TIMES),
        avg:
          TABLE_TIMES.reduce(function (a, v) {
            return a + v;
          }, 0) / TABLE_TIMES.length,
      },
    },
  };
  return result;
}

gs.print(JSON.stringify(main()));
