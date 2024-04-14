var START_DATE = new GlideDateTime("2023-01-01 00:00:00");
var END_DATE = new GlideDateTime("2023-12-31 23:59:59");

var RUN_AS_MAINT = true;

function main() {
  var tableMap = getScriptTablesAndColumns();

  var seenUpdates = {};

  var handledUpdates = {};

  for (var tableName in tableMap) {
    var updateNames = getUpdateNames(tableName);

    findHandledUpdates(
      START_DATE,
      END_DATE,
      tableName,
      tableMap[tableName],
      updateNames,
      seenUpdates,
      handledUpdates
    );
  }


  findUpdatesCreatedByCustomer(handledUpdates);

  var metrics = {
    all: {
      rc: 0, // Records changed
      loc: 0, // Lines of code changed
      crc: 0, // customerRecordsChanged
      cloc: 0, // customerLinesOfCodeChanged
    },
    byTable: {},
  };

  for (var updateName in handledUpdates) {
    var tableName = handledUpdates[updateName].tableName;
    var lines = handledUpdates[updateName].lines;
    var createdByCustomer = handledUpdates[updateName].createdByCustomer;

    if (!metrics.byTable[tableName]) {
      metrics.byTable[tableName] = {
        rc: 0, // Records changed
        loc: 0, // Lines of code changed
        crc: 0, // customerRecordsChanged
        cloc: 0, // customerLinesOfCodeChanged
      };
    }

    metrics.all.rc++;
    metrics.all.loc += lines;
    metrics.byTable[tableName].rc++;
    metrics.byTable[tableName].loc += lines;

    if (createdByCustomer) {
      metrics.all.crc++;
      metrics.all.cloc += lines;
      metrics.byTable[tableName].crc++;
      metrics.byTable[tableName].cloc += lines;
    }
  }

  gs.info(JSON.stringify(metrics));
}

var whitelist = [
  {
    name: "java.util.regex.Matcher",
    member: "find",
    signature: "()Z",
    modified: false,
  },
  {
    name: "com.glide.data.access.TableFactory",
    member: "get",
    signature: "(Ljava/lang/String;)Lcom/glide/data/access/ITable;",
    modified: false,
  },
  {
    name: "com.glide.data.access.ATable",
    member: "addReturnField",
    signature: "(Ljava/lang/String;)V",
    modified: false,
  },
  {
    name: "com.glide.data.access.internal.CachedTable",
    member: "query",
    signature: "()V",
    modified: false,
  },
  {
    name: "com.glide.data.access.internal.CachedTable",
    member: "next",
    signature: "()Z",
    modified: false,
  },
  {
    name: "com.glide.data.access.internal.CachedTable",
    member: "getValue",
    signature: "(Ljava/lang/String;)Ljava/lang/String;",
    modified: false,
  },
  {
    name: "com.glide.db.meta.TableIterator",
    member: "next",
    signature: "()Ljava/lang/Object;",
    modified: false,
  },
  {
    name: "com.glide.db.meta.ATableIterator",
    member: "getValue",
    signature: "(Ljava/lang/String;)Ljava/lang/String;",
    modified: false,
  },
  {
    name: "com.glide.db.DBQuery",
    member: "addReturnField",
    signature: "(Ljava/lang/String;)V",
    modified: false,
  },
  {
    name: "com.glide.db.DBQuery",
    member: "addNullQuery",
    signature: "(Ljava/lang/String;)Lcom/glide/util/IQueryCondition;",
    modified: false,
  },
  {
    name: "com.glide.db.DBQuery",
    member: "addOrderBy",
    signature: "(Ljava/lang/String;Z)Z",
    modified: false,
  },
];

var wlm = GlideWhiteListManager.get();
try {
  if (RUN_AS_MAINT) {
    // Add some API members to whitelist to avoid excessive logging from whitelist manager
    whitelist.forEach(function (api) {
      if (!wlm.isVisibleMember(api.name, api.member, api.signature)) {
        // gs.info('Adding member to whitelist: ' + api.name + ':' + api.member);
        api.modified = true;
        wlm.addToMemberWhitelist(api.name, api.member, api.signature);
      }
    });
  }

  // var startTime = new Date().getTime();
  main();
  // var endTime = new Date().getTime();
  // gs.info("Execution time: " + (endTime - startTime) + "ms");
} finally {
  if (RUN_AS_MAINT) {
    // Remove any whitelist members that were added
    whitelist.forEach(function (api) {
      if (api.modified) {
        // gs.info('Removing member from whitelist: ' + api.name + ':' + api.member);
        wlm.removeFromMemberWhitelist(api.name, api.member, api.signature);
      }
    });
  }
}

/**
 * Finds all columns [sys_dictionary] with a script-like internal type and the
 * tables they belong to.
 * @returns {ScriptTableMap}
 */
function getScriptTablesAndColumns() {
  var tableMap = {};

  var sys_dictionary = GlideRecord("sys_dictionary");
  sys_dictionary.setWorkflow(false);
  sys_dictionary
    .addQuery("internal_type", "script")
    .addOrCondition("internal_type", "script_client")
    .addOrCondition("internal_type", "script_plain")
    .addOrCondition("internal_type", "script_server");
  sys_dictionary.query();

  while (sys_dictionary.next()) {
    var tableName = sys_dictionary.getValue("name");
    if (!GlideDBObjectManager.get().isMetadataExtension(tableName)) {
      continue;
    }

    var columns = (tableMap[tableName] = tableMap[tableName] || []);
    columns.push({
      name: sys_dictionary.getValue("element"),
      internalType: sys_dictionary.getValue("internal_type"),
      defaultValue: (sys_dictionary.getValue("default_value") || "").replace(
        /\s+/g,
        ""
      ),
    });
  }

  return tableMap;
}

/**
 * Given a table name, finds the sys_update_name values for all records in
 * the table. Returns an object with the names as keys and true as values.
 * @param {string} tableName
 * @return {Record<string, boolean>}
 */
function getUpdateNames(tableName) {
  if (RUN_AS_MAINT) {
    var names = {};
    var checker = Packages.com.glide.data.access.TableFactory.get(tableName);
    checker.addReturnField("sys_update_name");
    checker.query();
    while (checker.next()) {
      names[checker.getValue("sys_update_name")] = true;
    }
    return names;
  } else {
    var names = {};
    var gr = new GlideRecord(tableName);
    gr.setWorkflow(false);
    gr.query();
    while (gr.next()) {
      names[gr.sys_update_name.toString()] = true;
    }
    return names;
  }
}

/**
 * Given the payload of an update XML record and the script-like columns of the
 * table it belongs to, determines if the payload contains any non-default values for
 * the script-like columns. Returns an object with a `handled` boolean and a `lines`
 * number for the total number of lines of code in each column.
 * @param {string} payload
 * @param {ScriptColumn[]} tableColumns
 * @returns {{ handled: boolean, lines: number }}
 */
function getUpdateHandledInfo(payload, tableColumns) {
  var handled = false;
  var lines = 0;
  for (var i in tableColumns) {
    var column = tableColumns[i];

    var pattern = Packages.java.util.regex.Pattern.compile(
      "<" +
        column.name +
        ">(<\\!\\[CDATA\\[)?([\\s\\S]*?)(\\]\\]>)?<\\/" +
        column.name +
        ">"
    );
    var matcher = pattern.matcher(payload);
    if (!matcher.find()) {
      continue;
    }

    var value = "" + matcher.group(2);
    var sanitizedValue = value.replace(/\s+/g, "");
    if (sanitizedValue === column.defaultValue || gs.nil(sanitizedValue)) {
      continue;
    }

    // CHANGE VS. LAST AUDIT: Don't count if this is a stub ACL following a common pattern
    if (
      sanitizedValue.indexOf("glide.security.allow_unauth_roleless_acl") !== -1
    ) {
      continue;
    }

    lines += (value.match(/\r\n|\r|\n/g) || "").length + 1;
    handled = true;
  }
  return { handled: handled, lines: lines };
}

/**
 * Iterates over all sys_update_xml records for a table and finds the ones that
 * meet the criteria for tracking. Mutates the `handledUpdates` map with the
 * relevant information. Also mutates the `seenUpdates` cache to prevent
 * reprocessing the same updates.
 * @param {string} startDate - e.g. "2023-01-01 00:00:00"
 * @param {string} endDate - e.g. "2023-12-31 23:59:59"
 * @param {string} tableName
 * @param {ScriptTableMap} tableMap
 * @param {Record<string, boolean>} updateNames
 * @param {SeenUpdatesCache} seenUpdates
 * @param {UpdateInfoMap} handledUpdates
 */
function findHandledUpdates(
  startDate,
  endDate,
  tableName,
  tableColumns,
  updateNames,
  seenUpdates,
  handledUpdates
) {
  var sys_update_xml = new GlideRecord("sys_update_xml");
  sys_update_xml.setWorkflow(false);
  sys_update_xml.addQuery("name", "IN", Object.keys(updateNames).join());
  sys_update_xml.addNullQuery("remote_update_set");
  sys_update_xml.orderByDesc("sys_recorded_at", true);
  sys_update_xml.addQuery("sys_created_on", ">=", startDate);
  sys_update_xml.addQuery("sys_created_on", "<=", endDate);
  sys_update_xml.query();

  while (true) {
    var next = sys_update_xml.next();
    if (!next) {
      break;
    }

    var updateName = sys_update_xml.getValue("name");
    if (seenUpdates[updateName]) {
      continue;
    }
    seenUpdates[updateName] = true;

    var replaceOnUpgrade = "" + sys_update_xml.getValue("replace_on_upgrade"); // Must convert to JS string
    var action = "" + sys_update_xml.getValue("action"); // Must convert to JS string
    if (replaceOnUpgrade === "1" || action === "DELETE") {
      continue;
    }

    var payload = sys_update_xml.getValue("payload");
    if (!payload) {
      continue;
    }

    var handledInfo = getUpdateHandledInfo(payload, tableColumns);

    if (handledInfo.handled) {
      handledUpdates[updateName] = {
        lines: handledInfo.lines,
        tableName: tableName,
      };
    }
  }
}

/**
 * Given a list of update names, finds the ones that were not created by the
 * customer. Mutates the updateMap object by adding a key `createdByCustomer`
 * for each update with a boolean value.
 * @param {UpdateInfoMap} updateMap
 */
function findUpdatesCreatedByCustomer(updateMap) {
  var sys_update_version = new GlideRecord("sys_update_version");
  sys_update_version.setWorkflow(false);
  sys_update_version.addQuery("source_table", "sys_upgrade_history");
  sys_update_version.addQuery("name", "IN", Object.keys(updateMap).join());
  sys_update_version.query();

  while (sys_update_version.next()) {
    updateMap[sys_update_version.getValue("name")].createdByCustomer = false;
  }

  for (var updateName in updateMap) {
    if (typeof updateMap[updateName].createdByCustomer === "undefined") {
      updateMap[updateName].createdByCustomer = true;
    }
  }
}