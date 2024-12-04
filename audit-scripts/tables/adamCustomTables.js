(function executeQuery() {

    var OUTPUT_VERSION = '1.3.12.0';
    var SCRIPT_VERSION = '1.3.13.2';
    var processStartTime = new GlideDateTime();

    var SAVE_RESULTS_FILE = false; // attach the results as a file to a record on the "admin" user

    // Ensure we are Orlando or beyond
    var buildName =  gs.getProperty("glide.buildname", "doesnotexist");
    var companyCode = gs.getProperty("glide.appcreator.company.code", "Not set");
    var smVer = '1';
    if(gs.getProperty("glide.entitlement.customer_instance.migrated", "false") == "true")
    {
        smVer = '2';
    }
    
    if(buildName.toLowerCase() < "orlando")
    {
        gs.info('This script requires Orlando or above to execute. Aborting.');
        return;
    }

    if(gs.hasRole("maint")== false)
    {
        gs.info('This script requires maint access. Aborting.');
        return;
    }

    var scopeID = '';
    var MAX_RECORDS = -1;
    var FILTER_ENCODED_QUERY = ''; //'ref_sys_db_object.nameSTARTSWITHu_';
    var CHECK_CUSTOMIZED = false;
    var SHOW_LOB = false;
    var SHOW_SCOPES = false;
    var SHOW_TABLES = true;
    var SHOW_TABLES_IGNORED = false;
    var ENABLE_DEBUG = false;
    var MINIMIZE_OUTPUT = true;
    var OUTPUT_SPACER = '\t';

    var INCLUDE_CLASSES = ['sys_db_object'];

    var DEBUG_INFO = [];
    var DEBUG_TIMER = new GlideDateTime();
    var TIMERS = [];
    var ISSUES = [];

    var ROOT_TABLE_LOB = {};
    var TABLE_CACHE = {};
    var LOB_CACHE = {};
    var CACHE_INFO = {};
    var OOTB_CACHE = {};
    var CACHE_HIT_COUNT = {'hierarchy': 0, 'lob': 0, 'extInfo': 0, 'packageInfo': 0, 'fieldCount': 0, 'scope': 0, 'exemptInfo': 0, 'ootb': 0};

    // it is MUCH MUCH MUCH faster to check hasOwnProperty compared in arrayUtils.contains
    var KNOWN_OOTB_TABLES = {};
    var KNOWN_STORE_TABLES = {};
    var KNOWN_STORE_TABLES_2 = {};

    var MISSING_MANIFEST_APPS = ['06a71b1367e4130051c9027e2685ef1e'];

    // manually added cmdb to make sure cmdb tables are always considered exempt
    var EXEMPT_CLASSES = ['cmdb'
    , 'cmdb_ci'
    ,'cmdb_qb_result_base'
    ,'cmn_location'
    ,'cmn_schedule_condition'
    ,'dl_definition'
    ,'dl_matcher'
    ,'kb_knowledge'
    ,'ml_ci_ml' // added in 2022
    ,'ml_cluster_detail' // correction for ml_ci_ml
    ,'scheduled_data_import'
    ,'sc_cat_item_delivery_task'
    ,'sf_state_flow'
    ,'sysauto'
    ,'syslog'
    ,'syslog0000'
    ,'syslog0001'
    ,'syslog0002'
    ,'syslog0003'
    ,'syslog0004'
    ,'syslog0005'
    ,'syslog0006'
    ,'syslog0007'
    ,'sys_auth_profile'
    ,'sys_dictionary'
    ,'sys_filter'
    ,'sys_hub_action_type_base'
    ,'sys_import_set_row'
    ,'sys_report_import_table_parent'
    ,'sys_transform_map'
    ,'sys_transform_script'
    ,'sys_user_preference'
    ,'sys_choice' // no longer on exemption list but was originally
    ,'sys_portal_page' // no longer on exemption list but was originally
    ];

    var UPGRADE_MANIFEST = new Packages.com.glide.update.collisions.UpgradeManifest();
    //UPGRADE_MANIFEST.addDirectoryFilter('dictionary');
    //UPGRADE_MANIFEST.addDirectoryFilter('update');
    //UPGRADE_MANIFEST.addDirectoryFilter('apply_once');
    //UPGRADE_MANIFEST.addDirectoryFilter('unload');
    UPGRADE_MANIFEST.load();

    var arrayUtils = new ArrayUtil();

    // cast a value to boolean
    var toBoolean = function (val)
    {
        if(val && val != 0)
        {
            return true;
        } else {
            return false;
        }
    };

    var debugTimer = function (eventName)
    {
       if(eventName)
       {
           TIMERS.push({'time': GlideDateTime.subtract(DEBUG_TIMER, new GlideDateTime()).getNumericValue() / 1000, 'name': eventName});
       }
       DEBUG_TIMER = new GlideDateTime();
    };

    var logInfo = function (msg) {
        ISSUES.push({
            'level': 'info',
            'msg': msg
        });
    };

    var logWarn = function (msg) {
        ISSUES.push({
            'level': 'warn',
            'msg': msg
        });
    };

    var logError = function (msg) {
        ISSUES.push({
            'level': 'error',
            'msg': msg
        });
    };

    // cast to an into to save characters in output
    var toBooleanInt = function (val)
    {
        if(val && val != 0)
        {
            return 1;
        } else {
            return 0;
        }
    };

    // get all the objects we are looking at 
    var getAppFiles = function (scopeID)
    {
        var gr = new GlideRecord('sys_metadata');
        if(scopeID)
        {
            gr.addQuery('sys_scope', 'IN', scopeID);
        }
        gr.addQuery('sys_class_name', 'IN', INCLUDE_CLASSES);
        if(FILTER_ENCODED_QUERY)
        {
            gr.addEncodedQuery(FILTER_ENCODED_QUERY);
            logInfo('Applying filter: ' + gr.getEncodedQuery());
        }
        if(MAX_RECORDS > 0)
        {
            gr.setLimit(MAX_RECORDS);
        }
        gr.queryNoDomain();
        return gr;
    };

    // quick access to check how many rows are in the given table
    var getTableRowCount = function (tableName, encodedQuery)
    {
        var agg = new GlideAggregate(tableName);
        if(agg.isValid() == false)
        {
            return -1;
        }
        agg.addAggregate('COUNT');
        if(encodedQuery)
        {
            agg.addEncodedQuery(encodedQuery);
        }
        agg.setGroup(false); // make sure we only get one row back
        agg.query();
        if(agg.next())
        {
            return Number(agg.getAggregate('COUNT'));
        }
        return 0;
    };

    var getAllotmentType = function (allotmentType)
    {
        switch (allotmentType)
        {
            case '1':
                return 'App Engine';
            case '2':
                return 'Grandfather';
            case '3':
                return 'Table Bundle';
            default:
                return 'Unknown';
        }
    };

    // read subscriptions
    var getSubscriptionInfo = function ()
    {
        var licenseInfo = { "subscriptionCount": 0, "table_count": 0, "tables_used": 0 };
        var licenseTypes = { 'total': JSON.parse(JSON.stringify(licenseInfo)), 'grandfather': JSON.parse(JSON.stringify(licenseInfo)), 'bundled': JSON.parse(JSON.stringify(licenseInfo)), 'appenginev1': JSON.parse(JSON.stringify(licenseInfo)) , 'appenginev2': JSON.parse(JSON.stringify(licenseInfo)) , 'unknown': JSON.parse(JSON.stringify(licenseInfo))};
    
        var lic = new GlideRecord('license_details');
        if (lic.isValid() == false)
        {
            return licenseInfo;
        }
        lic.addQuery('table_count', '!=', 'N/A');
        lic.addEncodedQuery('end_date>=javascript:gs.beginningOfToday()^start_date<=javascript:gs.endOfToday()');
        lic.query();

        while (lic.next())
        {
            var licType = 'unknown';
            var tableCount = lic.getValue('table_count');
            var tablesUsed = lic.getValue('tables_used');
            if (lic.getDisplayValue().toLowerCase().indexOf('grandfather') >= 0)
            {
                licType = 'grandfather';
            } else if (lic.getDisplayValue().toLowerCase().indexOf('engine') >= 0) {
                if(lic.getValue('table_count').toLowerCase() == 'unlimited')
                {
                    licType = 'appenginev2';
                    tableCount = 1000000;
                } else {
                    licType = 'appenginev1';
                }
            } else if (tableCount == parseInt(tableCount)) {
                licType = 'bundled';
            }
    
            // type specific
            licenseTypes[licType].subscriptionCount++;
            licenseTypes[licType].table_count += parseInt(tableCount);
            licenseTypes[licType].tables_used += parseInt(tablesUsed);
    
            // total
            licenseTypes.total.subscriptionCount++;
            licenseTypes.total.table_count += parseInt(tableCount);
            licenseTypes.total.tables_used += parseInt(tablesUsed);
        }
        return licenseTypes;
    };


    // cache all the tables that are rotated for quick reference
    var getRotatedTables = function ()
    {
        var ROTATED_TABLES = [];
        var rt = new GlideRecord('sys_table_rotation_schedule');
        rt.addQuery('name.name','NSAMEAS','table_name');
        rt.query();
        while(rt.next())
        {

            ROTATED_TABLES.push(rt.getValue('table_name')); 
        }
        return ROTATED_TABLES;
    };

    // cache all the m2m tables for quick reference
    var getM2MTables = function ()
    {
        var M2M_TABLES = [];
        var t = new GlideRecord('sys_m2m');
        //t.addQuery('m2m_table', '=', tableName);
        t.query();
        while(t.next())
        {
            M2M_TABLES.push(t.getValue('m2m_table')); 
        }
        return M2M_TABLES;
    };

    // cache all the app families
    var getAppFamilies = function ()
    {
        var APP_FAMILIES = {};
        var af = new GlideRecord('ua_app_family'); 
        af.addQuery('level', '=', 1);
        af.query();
        while(af.next())
        {
            APP_FAMILIES[af.getValue('scope')] = {"found": true, 'lob_name': af.getValue('lob_name'), 'lineage_id': af.getValue('lineage_id')};
            APP_FAMILIES[af.getValue('app_id')] = {"found": true, 'lob_name': af.getValue('lob_name'), 'lineage_id': af.getValue('lineage_id')};
        }
        return APP_FAMILIES;
    };

    // cache everything in the custom table inventory
    var getCustomTableInventory = function (invalidOnly)
    {
        var CUSTOM_TABLE_INVENTORY = [];
        var ct = new GlideRecord('ua_custom_table_inventory');
        if(invalidOnly)
        {
            ct.addNullQuery('table_ref.name');
            ct.addNullQuery('license').addOrCondition('allotment_type', 'NOT LIKE', 2); // grandfathered
        }
        ct.query();
        while(ct.next())
        {
            CUSTOM_TABLE_INVENTORY.push(ct.getValue('table_name')); 
        }
        return arrayUtils.unique(CUSTOM_TABLE_INVENTORY);
    };

    // store table license
    var getCustomTableLicenses = function ()
    {
        var TABLE_LICENSES = {};
        var tl = new GlideRecord('ua_custom_table_inventory');
        //tl.addNotNullQuery('license');
        tl.query();
        while(tl.next())
        {
            var dn = 'NONE';
            if(smVer == 1)
            {
                if(!gs.nil(tl.license))
                {
                    dn = tl.license.getDisplayValue();
                    if(gs.nil(dn))
                    {
                        dn = 'INVALID';
                    }
                }
            } else {
                if(!gs.nil(tl.subscription_entitlement))
                {
                    dn = tl.subscription_entitlement.getDisplayValue();
                    if(gs.nil(dn))
                    {
                        dn = 'INVALID';
                    }
                }
            }            
            TABLE_LICENSES[tl.getValue('table_name')] = {'sub': dn, 'type': getAllotmentType(tl.getValue('allotment_type')), 'ctiCreate': tl.getValue('sys_created_on')};
        }
        return TABLE_LICENSES;
    };

    // cache everything in the custom table inventory
    var getRemovedTablesFromCustomTableInventory = function (grandFatherOnly)
    {
        var REMOVED_CUSTOM_TABLES = [];
        var fp = 0;
        var exemptReason = '';
        var ct = new GlideRecord('ua_custom_table_inventory');
        ct.addNullQuery('table_ref.name');
        if(grandFatherOnly)
        {
            ct.addQuery('allotment_type', '=', 2); //grandfather
        } else {
            ct.addNullQuery('allotment_type').addOrCondition('allotment_type', '!=', 2); //grandfather
            exemptReason = 'dropped';
            fp = 1;
        }
        ct.query();
        while(ct.next())
        {
            REMOVED_CUSTOM_TABLES.push({'name': ct.getValue('table_name')
                                ,'ctiCreated': getCTICreationDate(ct.getValue('table_name'))
                                ,'allotmentType': getTableAllotmentType(ct.getValue('table_name'))
                                ,'license': getTableLicense(ct.getValue('table_name'))
                                ,'in_CTI': 1
                                ,'fp': fp
                                ,'exemptReason': exemptReason} ); 
        }
        return REMOVED_CUSTOM_TABLES;
    };

    //
    var getGrandfatheredTablesMissingSubscription = function ()
    {
        var GF_TABLES_MISSING_SUBSCRIPTION = [];
        var ct = new GlideRecord('ua_custom_table_inventory');
        ct.addNullQuery('license.name');
        ct.addQuery('allotment_type', '=', 2); //grandfather
        ct.query();
        while(ct.next())
        {
            GF_TABLES_MISSING_SUBSCRIPTION.push(ct.getValue('table_name')); 
        }
        return GF_TABLES_MISSING_SUBSCRIPTION;
    };
    


    // cache everything in the custom table inventory
    var getExemptTableInventory = function ()
    {
        var EXEMPT_TABLES = [];
        var et = new GlideRecord('ua_exempted_table_inventory');
        et.query();
        while(et.next())
        {
            EXEMPT_TABLES.push(et.getValue('table_name')); 
        }
        return EXEMPT_TABLES;
    };

    // init table cache
    var initTableCache = function (tableName)
    {
        if(TABLE_CACHE.hasOwnProperty(tableName) == false)
        {
            TABLE_CACHE[tableName] = {'extInfo': null, 'package': null, 'fieldCount': -1, 'related': {}, 'referencing': {}, 'references': {}, 'exemptInfo': {}};
        }
    };

    var getRootExtension = function (tableName)
    {
        initTableCache(tableName);
        if(gs.nil(TABLE_CACHE[tableName].extInfo))
        {
            getExtensionInfo(tableName);
        }
        return TABLE_CACHE[tableName].extInfo.rootExt;
    };

    var getFirstExtension = function (tableName)
    {
        initTableCache(tableName);
        if(gs.nil(TABLE_CACHE[tableName].extInfo))
        {
            getExtensionInfo(tableName);
        }
        return TABLE_CACHE[tableName].extInfo.firstExt;
    };

    var getDirectExtension = function (tableName)
    {
        initTableCache(tableName);
        if(gs.nil(TABLE_CACHE[tableName].extInfo))
        {
            getExtensionInfo(tableName);
        }
        return TABLE_CACHE[tableName].extInfo.directExt;
    };

    var getExtensionInfo = function (tableName)
    {
        initTableCache(tableName);
        if(gs.nil(TABLE_CACHE[tableName].extInfo)) // might need optimize for nulls
        {
            var extInfo = {'rootExt': null, 'directExt': null, 'firstExt': null, 'depth': 0};
            var table = new TableUtils(tableName);
            var tableArrayList = table.getTables();
            var tableArray = j2js(tableArrayList);
            // get the key extensions
            extInfo.depth = tableArray.length;
            extInfo.rootExt = tableArray[tableArray.length-1];
            if(tableArray.length > 1)
            {
                extInfo.directExt = tableArray[1];
                if(tableArray.length > 3)
                {
                    extInfo.firstExt = tableArray[tableArray.length-2];
                }
            }
            TABLE_CACHE[tableName].extInfo = extInfo;
        } else {
            CACHE_HIT_COUNT.extInfo++;
        }
        return TABLE_CACHE[tableName].extInfo;
    }


    // this is correct for global, but need better logic for non-tables in scopes
    var checkIsOOTB = function (metaGR)
    {
        var isOOTB = null;
        try {
            if(metaGR.getRecordClassName() == 'sys_db_object')
            {
                var tableName = metaGR.ref_sys_db_object.name;
                if(OOTB_CACHE.hasOwnProperty(tableName))
                {
                    CACHE_HIT_COUNT.ootb++;
                    return OOTB_CACHE[tableName];
                }
                // just report sys_ tables as always being OOTB
                //if(arrayUtils.contains(KNOWN_OOTB_TABLES, tableName) || tableName.substring(0, 3) == 'sys')
                if(KNOWN_OOTB_TABLES.hasOwnProperty(tableName) || tableName.substring(0, 3) == 'sys')
                {
                    return true;
                }
                isOOTB = UPGRADE_MANIFEST.containsFile(tableName + ".xml");
                // double check table isn't in the wrong spot
                if(!isOOTB)
                {
                    isOOTB = UPGRADE_MANIFEST.containsFile(metaGR.getValue('sys_update_name') + ".xml");
                    if(isOOTB)
                    {
                        logWarn('Found table in 2nd pass: ' + metaGR.getValue('sys_update_name'));
                    }
                }
                OOTB_CACHE[tableName] = isOOTB;
            } else {
                isOOTB = UPGRADE_MANIFEST.containsFile(metaGR.getValue('sys_update_name') + ".xml");
            }
        } catch (e) {
            logWarn("Failed to detect if OOTB for: " + fileName);
        }
        return isOOTB;
    };

    // is the metadata record deleted?
    var checkIsDeleted = function (metaGR)
    {
        if(metaGR.getRecordClassName() == 'sys_metadata_delete')
        {
            return true;
        }
        return false;
    };

    // is the record customized?
    var checkIsCustomized = function(metaGR)
    {
        var isCustomized = null;
        try {
            isCustomized = !sn_collision.CollisionAPI.willBeReplacedOnUpgrade(metaGR.getValue('sys_update_name'))
        } catch (e) {
            logWarn("Failed to detect customization for: " + metaGR.getValue('sys_name'));
        }
        return isCustomized;
    };

    // is this is a package that is a store app?  Not all sys_store_app records are actually in the store
    var checkIsStoreApp = function (metaGR)
    {
        var isStore = null;
        isStore = toBoolean(metaGR.sys_package.getRefRecord().getValue('is_store_app'));
        if(!isStore)
        {
            isStore = arrayUtils.contains(MISSING_MANIFEST_APPS, metaGR.getValue('sys_scope'))
        }
        return isStore;
    };

    // does this record require app engine licensing (was it a paid partner app or free?)
    var checkNeedsAppEngine = function (metaGR)
    {
        var isStore = null;
        isStore = (metaGR.sys_package.getRefRecord().getValue('needs_app_engine_licensing'));
        return toBoolean(isStore);
    };

    // is this table in the rotated table cache?
    var checkRotatedTable = function (tableName)
    {
        return arrayUtils.contains(ROTATED_TABLES, tableName);
    };

    // is this a M2M table?
    var checkManyToManyTable = function (tableName)
    {
        return arrayUtils.contains(M2M_TABLES, tableName);
    };

    // is this currently in the custom table inventory?
    var checkInCustomTableInventory = function (tableName)
    {
        return arrayUtils.contains(CUSTOM_TABLES, tableName);
    };

    // is this an invalid table in the custom table inventory?
    var checkInInvalidCustomTableInventory = function (tableName)
    {
        return arrayUtils.contains(INVALID_CUSTOM_TABLES, tableName);
    };

    // is this currently in the exempt table inventory?
    var checkInExemptTableInventory = function (tableName)
    {
        return arrayUtils.contains(EXEMPT_TABLES, tableName);
    };

    // is there a license for the table?
    var getTableLicense = function (tableName)
    {
        if(CUSTOM_TABLE_LICENSES.hasOwnProperty(tableName))
        {
            return CUSTOM_TABLE_LICENSES[tableName].sub;
        }
        return 'NONE';
    };
    
    var getTableAllotmentType = function (tableName)
    {
        if(CUSTOM_TABLE_LICENSES.hasOwnProperty(tableName))
        {
            return CUSTOM_TABLE_LICENSES[tableName].type;
        }
    };

    var getCTICreationDate = function (tableName)
    {
        if(CUSTOM_TABLE_LICENSES.hasOwnProperty(tableName))
        {
            return CUSTOM_TABLE_LICENSES[tableName].ctiCreate;
        }
    };

    // is this a CMDB table (as defined in the custom table guide)
    var checkIsCMDBTable = function (tableName)
    {
        var absoluteRoot = getRootExtension(tableName);
        // starts with CMDB (per table guide)
        if(gs.nil(absoluteRoot))
        {
            return false;
        }
        return absoluteRoot.startsWith('cmdb');
    };

    // is this an OOTB store table from the manual manifest
    var checkStoreOOTBTable = function (tableName)
    {
        return KNOWN_STORE_TABLES.hasOwnProperty(tableName) || KNOWN_STORE_TABLES_2.hasOwnProperty(tableName);
    };

    /**
     * While not currenly OOTB, table appears to be a legacy OOTB table
     */
    var checkLegacyOOTB = function (tableObj)
    {
        // u_ or x_ tables are never shipped OOTB
        if(tableObj.ref_sys_db_object.name.substring(0,2) == 'u_' || tableObj.ref_sys_db_object.name.substring(0,2) == 'x_')
        {
            return false;
        }
        if(tableObj.getValue('sys_scope') == 'global' && !tableObj.sys_package.nil() && tableObj.getValue('sys_package') != 'global')
        {
            return true;
        }
        // can't find a reason to think it is OOTB
        return false;
    };

    /**
     * Check if this is a document table (requires Indexed Document Store)
     */
    var checkIsDocTable = function (tableObj)
    {
        // u_ or x_ tables are never shipped OOTB
        if(!gs.nil(tableObj.ref_sys_db_object.is_document_table.toString()) && tableObj.ref_sys_db_object.is_document_table.toString() == "true")
        {
            return true;
        }
        // can't find a reason to think it is OOTB
        return false;
    };

    // is this an exempt table?
    var checkIsExempt = function (tableObj)
    {
        var tableName = tableObj.getValue('name');
        initTableCache(tableName);
        if(gs.nil(TABLE_CACHE[tableName].exemptInfo.isExempt)) // might need to optimize for nulls
        {
            var exemptInfo = {"isExempt": false, "exemptReason": null};
            // check naming conventions first
            if(gs.nil(tableName))
            {
                exemptInfo.isExempt = true;
                exemptInfo.exemptReason = "noname";
                
            } else if(tableName.indexOf('$par') > 0)
            {
                exemptInfo.isExempt = true;
                exemptInfo.exemptReason = "partition";
            } else if(tableName.indexOf('sh$') == 0)
            {
                exemptInfo.isExempt = true;
                exemptInfo.exemptReason = "other";
            } else if(tableName.substring(0,3) == 'ts_')
            {
                exemptInfo.isExempt = true;
                exemptInfo.exemptReason = "textsearch";
            } else if(tableName.substring(0,3) == 'ar_')
            {
                exemptInfo.isExempt = true;
                exemptInfo.exemptReason = "archive";
            } else if (checkStoreOOTBTable(tableName) == true)
            {
                exemptInfo.isExempt = true;
                exemptInfo.exemptReason = "storeOOTB";
            } else if (checkIsDocTable(tableName) == true)
            {
                exemptInfo.isExempt = true;
                exemptInfo.exemptReason = "docTable";
            }

            // if we aren't exempt, keep checking
            if(!exemptInfo.isExempt)
            {
                // check table properties
                // is a remote table?
                if(tableObj.getValue('scriptable_table') == true)
                {
                    exemptInfo.isExempt = true;
                    exemptInfo.exemptReason = "remote";
                } else if(tableObj.ref_sys_db_object.provider_class.nil() == false) // system generated view/tables (v_ tables)
                {
                    exemptInfo = true;
                    exemptInfo = 'systemgenerated';
                }
            }

            /*
            // not in an update name, not sure if this is valid or not
            if(file.sys_update_name.nil())
            {
                exemptInfo = true;
                exemptInfo = 'noupdatename';
            }*/

            // if we aren't exempt, keep checking
            if(!exemptInfo.isExempt)
            {
                // check other metadata
                var absoluteRoot = getRootExtension(tableName);
                var firstExt = getFirstExtension(tableName);
                var directExt = getDirectExtension(tableName);
                // starts with CMDB (per table guide)
                if(checkIsCMDBTable(absoluteRoot))
                {
                    exemptInfo.isExempt = true;
                    exemptInfo.exemptReason = "cmdb";
                } else if(arrayUtils.contains(EXEMPT_CLASSES, absoluteRoot) || arrayUtils.contains(EXEMPT_CLASSES, firstExt) || arrayUtils.contains(EXEMPT_CLASSES, directExt))
                {
                    exemptInfo.isExempt = true;
                    exemptInfo.exemptReason = "baseTable";
                } else if(checkManyToManyTable(tableName)) // is registered as m2m?
                {
                    exemptInfo.isExempt = true;
                    exemptInfo.exemptReason = "m2m";
                } else if(checkRotatedTable(tableName) || (absoluteRoot && checkRotatedTable(absoluteRoot))) // is rotation
                {
                    /** @todo Check all the extensions along the way */
                    exemptInfo.isExempt = true;
                    exemptInfo.exemptReason = "rotated";
                } /*
                else if (checkInInvalidCustomTableInventory(tableName)) { // this will never get because it is missing the table
                    exemptInfo.isExempt = true;
                    exemptInfo.exemptReason = "missingtable";
                }
                */
            }
            TABLE_CACHE[tableName].exemptInfo = exemptInfo;
        } else {
            CACHE_HIT_COUNT.exemptInfo++;
        }
        return TABLE_CACHE[tableName].exemptInfo;
    };

    // was this created by a maint user?
    var checkIsMaintCreated = function (tableObj)
    {
        var sys_created_by = tableObj.sys_created_by.toString();
        return (sys_created_by.substring(sys_created_by.length-4) == '@snc');
    };

    var getFieldCounts = function ()
    {
        var FIELD_COUNTS = {};
        var fc = new GlideAggregate('sys_dictionary');
        fc.groupBy('name');
        fc.addQuery('active', '=', true);
        fc.addAggregate('COUNT');
        fc.query();
        while(fc.next())
        {
            FIELD_COUNTS[fc.getValue('name')] = Number(fc.getAggregate('COUNT'));
        }
        return FIELD_COUNTS;
    };

    // get the field count
    var getFieldCount = function (tableName)
    {
        return FIELD_COUNTS[tableName];
    };

    /**
     * Retrieve family ID for the package
     * 
     * @param {string} packageID Package to get the family ID for
     * @param {string} scopeID Scope to get the family ID for
     * @return {string} Name of App Family
     */
    var getFamilyID = function (scopeID, packageID)
    {
        scopeID = scopeID || '';
        packageID = packageID || '';

        var appFamilyInfo = {"found": false, "lob_name": null, "lineage_id": null};
        var familyID = 'unknownfamily';
        var lobName = 'unknownlob';
        
        // if we have a non-global package, check what app family that is in
        if (packageID != 'global' && !gs.nil(packageID) && APP_FAMILIES.hasOwnProperty(packageID))
        {    
            appFamilyInfo = APP_FAMILIES[packageID];
        } else if (packageID != 'global' && !gs.nil(packageID) && APP_FAMILIES.hasOwnProperty('com.' + packageID))
        {    
            appFamilyInfo = APP_FAMILIES['com.' + packageID];
        } else if (scopeID != 'global' && APP_FAMILIES.hasOwnProperty(scopeID))
        {
            appFamilyInfo = APP_FAMILIES[scopeID];
        }

        // if we found an app family, use it
        if (appFamilyInfo.found == true) 
        {
            if(!GlideStringUtil.isEligibleSysID(appFamilyInfo.lob_name))
            {
                lobName = appFamilyInfo.lob_name;
            }
            familyID = appFamilyInfo.lineage_id;
        } else if (scopeID != 'global') {
            // don't do anything here
        } else if (!gs.nil(packageID) && packageID != 'global') {
            // if we have a global scope and non-global package, use that
            if(packageID.substring(0,9) == 'com.glide' || packageID.substring(0,11) == 'apps/system' ||  packageID.substring(0,8) == 'com.snc.')
            {
                // if we have a known platform package, put it in the platform family
                lobName = 'Now Platform';
                familyID = 'platform';
            } else {
                //lobName = packageID; // default to the package name
                familyID = packageID; // default to the package name
            }
        } else {
            lobName = 'App Engine';
            familyID = 'app_engine';
        }
        // if we don't have a family, mark it as an error
        if(!familyID)
        {
            familyID = 'errorgettingfamily';
        }
        var res = {'lob': lobName, 'family': familyID.toLowerCase()};
        return res;
    };

    /**
     * Get info on references
     */
    var getTableReferences = function (tableName)
    {
        var c = new GlideRecord('sys_dictionary');
        c.addQuery('name', '=', tableName);
        c.addQuery('internal_type', '=', 'reference');
        c.addQuery('active', '=', true);
        c.query();
        return c;
    };

    var getReferencingTables = function (tableName)
    {
        var c = new GlideRecord('sys_dictionary');
        c.addQuery('reference', '=', tableName);
        c.addQuery('internal_type', '=', 'reference');
        c.addQuery('active', '=', true);
        c.query();
        return c;
    };

    // get the Line of Business given a plugin id and scope
    var getLoB = function (pluginId, scopeName)
    {
        var lobKey = pluginId + '-' + scopeName;
        var lobName = '';

        if(LOB_CACHE.hasOwnProperty(lobKey))
        {
            CACHE_HIT_COUNT.lob++;
            return LOB_CACHE[lobKey];
        }

        if(gs.nil(lobName) && !gs.nil(scopeName) && scopeName)
        {
            // check scope
            lobName = getLobFromScope(scopeName);
        }
        if(gs.nil(lobName) && !gs.nil(pluginId))
        {
            // hard code some specific results
            switch(pluginId)
            {
                case "com.snc.cmdb":
                    return 'CMDB';
            }
            // check the LoB for package
            var lob = new GlideRecord('ua_app_family');
            lob.addQuery('level', '=', 1);
            lob.addQuery('app_id', '=', pluginId).addOrCondition('app_id', '=', 'com.' + pluginId); // handle known variations
            lob.setLimit(1); // this may return multiple values, but we'll pick the first
            lob.query();
            if(lob.next())
            {
                return lob.getValue('lob_name');
            }
            if(pluginId.substring(0,9) == 'com.glide' || pluginId.substring(0,11) == 'apps/system' ||  pluginId.substring(0,8) == 'com.snc.')
            {
                // if we have a known platform package, put it in the platform family
                return 'Now Platform';
            }
        }
        if(gs.nil(lobName) == true)
        {
            if(!gs.nil(lob.getValue('lineage_id')) && lob.getValue('lineage_id').startsWith('itom'))
            {
                lobName = "ITOM";
            }
            lobName = 'Unknown';
        }
        LOB_CACHE[lobKey] = lobName;
        return LOB_CACHE[lobKey];
    };

    // get the LoB given a scope name
    var getLobFromScope = function (scopeName)
    {
        if(LOB_CACHE.hasOwnProperty(scopeName))
        {
            CACHE_HIT_COUNT.scope++;
            return LOB_CACHE[scopeName];
        }

        if(scopeName == 'global')
        {
            LOB_CACHE[scopeName] = null;
        } else {
            var appFamily = new GlideAggregate('ua_app_family');
            appFamily.addQuery('level', '=', 1);
            appFamily.addQuery('scope', '=', scopeName).addOrCondition('app_id', '=', 'com.' + scopeName).addOrCondition('app_id', '=', scopeName); // handle known variations
            appFamily.groupBy('lob_name');
            appFamily.groupBy('lineage_name');
            appFamily.query();
            if(appFamily.getRowCount() == 1)
            {
                appFamily.next();
                if(appFamily.getValue('lob_name'))
                {
                    LOB_CACHE[scopeName] = appFamily.getValue('lob_name');
                } else {
                    LOB_CACHE[scopeName] = appFamily.getValue('lineage_name');
                }
            }
        }
        return LOB_CACHE[scopeName];
    };


    // get the table package
    var getTablePackage = function (tableName)
    {
        initTableCache(tableName);
        if(gs.nil(TABLE_CACHE[tableName].packageInfo))
        {
            var p = new GlideRecord('sys_db_object');
            p.addQuery('name', '=', tableName);
            p.query();
            if(p.next())
            {
                TABLE_CACHE[tableName].packageInfo = {'pluginId': p.sys_package.source.getDisplayValue(), 'scopeName': p.sys_scope.scope.getDisplayValue()};
            }
        } else {
            CACHE_HIT_COUNT.packageInfo++;
        }
        return TABLE_CACHE[tableName].packageInfo;
    };

    // get the root table looking at the original table or children only
    var getRootLicensedTable = function (tableName, childrenOnly)
    {
        var lobs = {};
        var table = new TableUtils(tableName);
        var tab = j2js(table.getTables());

        for(var t in tab)
        {
            if(!(childrenOnly && tab[t] == tableName) && tab[t] != 'sys_meta')
            {
                if(ROOT_TABLE_LOB.hasOwnProperty(tab[t]) == false)
                {
                    var tableInfo = getTablePackage(tab[t]);
                    ROOT_TABLE_LOB[tab[t]] = {'pluginId': tableInfo.pluginId, 'scopeName': tableInfo.scopeName, 'lobName': getLoB(tableInfo.pluginId, tableInfo.scopeName)};
                }
                if(ROOT_TABLE_LOB[tab[t]].lobName)
                {
                    lobs[ROOT_TABLE_LOB[tab[t]].lobName] = 1;
                }
            }
        }
        return Object.keys(lobs);
    };

    // examine the references of a table
    var checkRelations = function (relationType, tableName)
    {
        if(CACHE_INFO.hasOwnProperty(tableName + '-' + relationType))
        {
            CACHE_HIT_COUNT.hierarchy++;
            return;
        }
        var ref = null;
        if(relationType == 'references')
        {
            ref = getTableReferences(tableName);
        } else {
            ref = getReferencingTables(tableName);
        }

        while(ref.next())
        {
            if(relationType == 'references')
            {
                // referenced
                var rTable = ref.reference.getValue('name');
            } else {
                // referencing
                var rTable = ref.getValue('name');
            }
            var lobList = getRootLicensedTable(rTable, false);
            for(var l in lobList)
            {
                var lobName = lobList[l];
                // track references
                if(TABLE_CACHE[tableName][relationType].hasOwnProperty(lobName) == false)
                {
                    TABLE_CACHE[tableName][relationType][lobName] = 0;
                }
                TABLE_CACHE[tableName][relationType][lobName]++;
                // combined related
                if(TABLE_CACHE[tableName].related.hasOwnProperty(lobName) == false)
                {
                    TABLE_CACHE[tableName].related[lobName] = 0;
                }
                TABLE_CACHE[tableName].related[lobName]++;
            }
        }
        CACHE_INFO[tableName + '-' + relationType] = true;
    };


    var initCounters = function ()
    {
        var blank = {"ootb": 0
                    ,"legacyOOTB": 0
                    ,"store": 0
                    ,"storeOOTB": 0
                    ,"storeUserCreated": 0
                    ,"userCreated": 0
                    ,"userCreated50plus": 0
                    ,"maintCreated": 0
                    ,"exempt": 0
                    ,"exempt50plus": 0
                    ,"ignored": 0
                    ,"total": 0
                    ,"cifp": 0
                    ,"cifn": 0
                    ,"citbr": 0
                    ,"cis": 0
                    ,"cic": 0}; 
        if(CHECK_CUSTOMIZED)
        {
            blank.userCreatedModified = 0;
            blank.OOTBModified = 0;
            blank.storeModified = 0;
            blank.totalModified = 0;
        }
        return blank;
    };

    var initContainer = function ()
    {
        var container = {"count": initCounters()};
        if(INCLUDE_CLASSES.length > 1)
        {
            container.classes = {};
        }
        return container;
    };

    var incrementClassCount = function (object, varName, counterName)
    {
        // don't add breakdown by class if there is only one class
        if(INCLUDE_CLASSES.length > 1)
        {
            if(!object.classes.hasOwnProperty(varName))
            {
                object.classes[varName] = initCounters();
            }
            object.classes[varName][counterName]++;
        }
    };

    var incrementCount = function (object, varName, counterName)
    {
        if(!object.hasOwnProperty(varName))
        {
            object[varName] = initContainer();
        }
        object[varName].count[counterName]++;
    };

    var incrementCounters = function (scopeInfo, className, counterName)
    {
        res.summary.total.count[counterName]++;

        incrementClassCount(res.summary.total, className, counterName);

        if(SHOW_SCOPES)
        {
            incrementCount(res.scopes, scopeInfo.scopeName, counterName);
            incrementClassCount(res.scopes[scopeInfo.scopeName], className, counterName);
        }
        if(SHOW_LOB)
        {
            incrementClassCount(res.lobs[scopeInfo.lobName], className, counterName);
            incrementCount(res.lobs, scopeInfo.lobName, counterName);
        }

        /*
        if(scopeInfo.global)
        {
            res.summary.global.count[counterName]++;
            incrementClassCount(res.summary.global, className, counterName);
        } else if(scopeInfo.sn)
        {
            res.summary.sn.count[counterName]++;
            incrementClassCount(res.summary.sn, className, counterName);
        } else if(scopeInfo.x)
        {
            if(scopeInfo.x_snc)
            {
                res.summary.x_snc.count[counterName]++;
                incrementClassCount(res.summary.x_snc, className, counterName);
            } else if(scopeInfo.x_local) {
                res.summary.x_local.count[counterName]++;
                incrementClassCount(res.summary.x_local, className, counterName);
            } else {
                res.summary.x_external.count[counterName]++;
                incrementClassCount(res.summary.x_external, className, counterName);
            }
        }
        */
        return;
    };

    var detectLob = function (tableName)
    {
        // identify primary LoB from table
        TABLE_CACHE[tableName] = {'extends': getRootLicensedTable(tableName, true), 'related': {}, 'references': {}, 'referencing': {}};

        // set primary LoB
        var tableProfile = TABLE_CACHE[tableName];
        var primaryLob = 'Unknown';

        if(tableProfile['extends'].length > 0)
        {
            // find the first known, non-platform LoB
            
            for(var e = 0; e < tableProfile['extends'].length; e++)
            {
                if(!arrayUtils.contains(['Unknown', 'Now Platform'], tableProfile['extends'][e]))
                {
                    primaryLob = tableProfile['extends'][e];
                    break;
                }
            }
            // if we can't find one, then take the first choice
            if(gs.nil(primaryLob) || primaryLob == 'Unknown')
            {
                primaryLob = tableProfile['extends'][0];
            }
        }

        // if we can't identify the table from the extensions, check the references
        if((gs.nil(primaryLob) || primaryLob == 'Unknown') && Object.keys(tableProfile.related).length > 0)
        {
            // check what the table references
            checkRelations('references', tableName);
            // check what referenced this table
            checkRelations('referencing', tableName);
            var mostRef = {'name': '', 'value': -1};
            for(var r in tableProfile.related)
            {
                // Now Platform
                if(!arrayUtils.contains(['Unknown', 'Now Platform'], r) && tableProfile.related[r] > mostRef.value)
                {
                    mostRef.name = r;
                    mostRef.value = tableProfile.related[r];
                } 
            }    
            primaryLob = mostRef.name;
        }
        TABLE_CACHE[tableName].primaryLob = primaryLob;
        return TABLE_CACHE[tableName].primaryLob;
    };

    // summerize the 
    var getTableInfo = function (tableObj)
    {
        var tableName = tableObj.ref_sys_db_object.name.toString();
        var likelyOOTB = checkLegacyOOTB(tableObj);
        var isStoreOOTB = checkStoreOOTBTable(tableName);
        var isDocTable = checkIsDocTable(tableObj);
        var isOOTB = checkIsOOTB(tableObj) || isStoreOOTB || likelyOOTB;
        var isCustom = false;
        var fn = false;
        var fp = false;
        var inCI = checkInCustomTableInventory(tableName);
        var inCIInvalid = checkInInvalidCustomTableInventory(tableName);
        var exemptInfo = checkIsExempt(tableObj.ref_sys_db_object.getRefRecord());
        var appType = '';

        switch(tableObj.sys_package.sys_class_name.toString())
        {
            case 'sys_plugins':
                appType = 'plugin';
                break;
            case 'sys_store_app':
                appType = 'store';
                break;
            case 'sys_app':
                appType = 'custom';
                break;
        }

        if(!isOOTB && !exemptInfo.isExempt)
        {
            isCustom = true; 
        }

        if(isOOTB == true)
        {
            exemptInfo.isExempt = false;
            exemptInfo.exemptReason = 'OOTB';
        }

        if(isCustom && !inCI)
        {
            fn = true; 
        }
        if(inCI && (!isCustom || inCIInvalid))
        {
            fp = true; 
        }


        var tableInfo = {'name': tableName
                        ,'sys_scope': tableObj.sys_scope.scope.toString()
                        ,'sys_created_on': tableObj.sys_created_on.toString()
                        ,'extInfo': null
                        ,'isCustom': toBooleanInt(isCustom)
                        ,'isExempt': toBooleanInt(exemptInfo.isExempt)
                        ,'fn': toBooleanInt(fn)
                        ,'fp': toBooleanInt(fp)
                        ,'license': getTableLicense(tableName)
                        ,'allotmentType': getTableAllotmentType(tableName)
                        ,'ctiCreated': getCTICreationDate(tableName)
                        ,'exemptReason': exemptInfo.exemptReason
                        ,'isOOTB': toBooleanInt(isOOTB)
                        ,'likelyOOTB': toBooleanInt(likelyOOTB)
                        /* ,'detectedLob': detectLob(tableName) */
                        ,'sys_created_by': null
                        ,'maint_created': toBooleanInt(checkIsMaintCreated(tableObj))
                        ,'m2m': toBooleanInt(checkManyToManyTable(tableName))
                        ,'cmdb': toBooleanInt(false)
                        ,'rotated': toBooleanInt(false)
                        ,'appType': appType
                        ,'is_store_app': toBooleanInt(checkIsStoreApp(tableObj))
                        ,'is_store_ootb': toBooleanInt(isStoreOOTB)
                        ,'is_doc_table': toBooleanInt(isDocTable)
                        ,'needs_ae': toBooleanInt(checkNeedsAppEngine(tableObj))
                        ,'in_CTI': toBooleanInt(inCI)
                        ,'inCIInvalid': toBooleanInt(inCIInvalid)
                        ,'in_ETI': toBooleanInt(checkInExemptTableInventory(tableName))
                        ,'fieldCount': getFieldCount(tableName)
                        };
        var sys_created_by = tableObj.sys_created_by.toString();

        if(!tableObj.ref_sys_db_object.super_class.nil())
        {
            tableInfo.extInfo = getExtensionInfo(tableName);
        }
        // this is not taking into account all the extensions along the way
        if(checkRotatedTable(tableName) || (tableInfo['extends'] && checkRotatedTable(tableInfo['extends'])))
        {
            tableInfo.rotated = toBooleanInt(true);
        }
        if(checkIsCMDBTable(tableName)) // function now checks root || (tableInfo['extends'] && checkIsCMDBTable(tableInfo['extends']))
        {
            tableInfo.cmdb = toBooleanInt(true);
        }
        if(sys_created_by == 'system' || sys_created_by == 'admin' || sys_created_by == 'glide.maint')
        {
            tableInfo.sys_created_by = sys_created_by;
        } else if(toBoolean(tableInfo.maint_created))
        {
            tableInfo.sys_created_by = sys_created_by;
        } else {
            tableInfo.sys_created_by = 'Customer';
        }
        return tableInfo;
    };


    /**
     * Start the actual processing here.
     */

    var LOCAL_COMPANY_CODE = gs.getProperty("glide.appcreator.company.code");
    //var IMPORT_SET_ROW_SYS_ID = getImportSetRowTableSysID();

    //gs.info('Getting all metadata files');

    /**
     * Get the files and run
     */
    var file = getAppFiles(scopeID);

    // init objects with needed metadata
    debugTimer();
    var ROTATED_TABLES = getRotatedTables();
    debugTimer('getRotatedTables');
    var M2M_TABLES = getM2MTables();
    debugTimer('getM2MTables');
    var APP_FAMILIES = getAppFamilies();
    debugTimer('getAppFamilies');
    var CUSTOM_TABLES = getCustomTableInventory(false);
    debugTimer('getCustomTableInventory');
    var CUSTOM_TABLE_LICENSES = getCustomTableLicenses();
    debugTimer('getCustomTableLicenses');
    var INVALID_CUSTOM_TABLES = getCustomTableInventory(true);
    debugTimer('getCustomTableInventory');
    var REMOVED_GF_TABLES = getRemovedTablesFromCustomTableInventory(true);
    debugTimer('getRemovedTablesFromCustomTableInventory - Grandfather Only');
    var REMOVED_CTI_TABLES = getRemovedTablesFromCustomTableInventory(false);
    debugTimer('getRemovedTablesFromCustomTableInventory - All');
    var GF_TABLES_MISSING_SUBSCRIPTION = getGrandfatheredTablesMissingSubscription();
    debugTimer('getGrandfatheredTablesMissingSubscription');
    var FIELD_COUNTS = getFieldCounts();
    debugTimer('getFieldCounts');
    var knownRemovedCount = 0;

    var EXEMPT_TABLES = getExemptTableInventory();
    debugTimer('getExemptTableInventory');

    //gs.info('Starting Processing');

    var res = {"info": {"runTime": null
                        ,"asOf": new GlideDateTime().toString()
                        ,"instance": gs.getProperty('instance_name','unknown')
                        ,"instanceName": gs.getProperty('instance_name','unknown')
                        ,'instanceURL': gs.getProperty('glide.servlet.uri', '')
                        ,"buildName": buildName
                        ,"buildTag": gs.getProperty("glide.buildtag", "doesnotexist")
                        ,'companyCode': companyCode
                        ,'smVer': smVer
                        ,'scriptVersion': SCRIPT_VERSION
                        ,"outputVersion": OUTPUT_VERSION},
                "customInventory": {
                    "userCreated": null /* actual custom tables */
                    ,"ua_custom_table_inventory": getTableRowCount('ua_custom_table_inventory')
                    ,"delta": null
                    ,"cifn": null /* false neg */
                    ,"cifp": null /* false pos */
                    ,"cirgf": null
                    ,"cirgfms": null
                    ,"remove": {'invalidTable': INVALID_CUSTOM_TABLES.length}
                    ,"ua_custom_table_inventory_unique": CUSTOM_TABLES.length
                    ,"ua_exempted_table_inventory": getTableRowCount('ua_exempted_table_inventory')
                },
                "subscriptions": getSubscriptionInfo(),
                "summary": {"total": initContainer()
                            ,"global": initContainer()
                            ,"sn": initContainer()
                            ,"x_local": initContainer()
                            ,"x_snc": initContainer()
                            ,"x_external": initContainer()
                }
                ,"lobs": {}
                ,"scopes": {}
                ,"tables": {"custom": {}
                            ,"exempt": {}
                            ,"fp": {}
                            ,"u": {}
                            ,"remove": {}
                }
                ,"timers": []
            };

    while(file.next())
    {
        var analyzeStart = new GlideDateTime();
        var scopeName = file.sys_scope.getRefRecord().getValue('scope');
        var scopeID = file.getValue('sys_scope');
        var packageID = file.sys_package.getRefRecord().getValue('source');
        var familyInfo = getFamilyID(scopeName, packageID);
        var className = file.getRecordClassName();
        var isStoreApp = checkIsStoreApp(file);
        var isOOTB = null;
        // don't check the manifest for known store tables
        if(!isStoreApp)
        {
            isOOTB = checkIsOOTB(file);
        }
        var isCustomized = null;
        var isDeleted = checkIsDeleted(file);
        var tableName = file.ref_sys_db_object.name.toString();
        var isStoreOOTB = checkStoreOOTBTable(tableName);
        //var isNeedAppEngine = checkNeedsAppEngine(file);
        var isExempt = false;
        var isLegacyOOTB = checkLegacyOOTB(file);
        var exemptReason = null;
        var isMaint = checkIsMaintCreated(file);
        var customInventoryFP = false;
        var customInventoryFN = false;
        var customInventoryTBR = false;
        var customInventoryStore = false;

        // only check customization for OOTB
        if(CHECK_CUSTOMIZED && isOOTB)
        {
            isCustomized = checkIsCustomized(file);
        }

        var scopeInfo = {"scopeName": scopeName
                        ,"packageID": packageID
                        ,"lobName": familyInfo.lob
                        ,"global": false
                        ,"sn": false
                        ,"x_local": false
                        ,"x_snc": false
                        ,"x": false
                        ,"store": isStoreApp};

        var ignoreRecord = false;
        var ignoreReason = null;

        if(!isOOTB && isDeleted)
        {
            ignoreRecord = true;
        }
        
        // handle tables with some special logic compared to all other classes

        if(file.getRecordClassName() == 'sys_db_object')
        { 
            var tableName = '';
            // No Name
            if(file.ref_sys_db_object.name.nil())
            {
                ignoreRecord = true;
            } else {
                tableName = file.ref_sys_db_object.name.toString();
            }
            // not in an update set
            if(file.sys_update_name.nil())
            {
                ignoreRecord = true;
            }

            // check exempt
            var exemptInfo = checkIsExempt(file.ref_sys_db_object.getRefRecord());
            exemptReason = exemptInfo.exemptReason;
            isExempt = exemptInfo.isExempt;

            // summarize custom inventory
            if(checkInCustomTableInventory(tableName) == true && (isExempt || ignoreRecord || isMaint))
            {
                if(isExempt)
                {
                    knownRemovedCount++;
                    if(res.customInventory.remove.hasOwnProperty(exemptReason) == false)
                    {
                        res.customInventory.remove[exemptReason] = 0;
                    }
                    res.customInventory.remove[exemptReason]++;
                } else if (ignoreRecord) {
                    knownRemovedCount++;
                    if(res.customInventory.remove.hasOwnProperty(ignoreReason) == false)
                    {
                        res.customInventory.remove[ignoreReason] = 0;
                    }
                    res.customInventory.remove[ignoreReason]++;
                }
            }
  
            if(isOOTB == false && isStoreOOTB == false && ignoreRecord == false)
            {
                if(isExempt == true)
                {
                    // init exempt reason storage
                    if(res.tables.exempt.hasOwnProperty(exemptReason) == false)
                    {
                        res.tables.exempt[exemptReason] = {};
                    }
                    res.tables.exempt[exemptReason][tableName] = getTableInfo(file);
                    if(checkInCustomTableInventory(tableName) == true)
                    {
                        if(exemptReason == 'remote' || exemptReason == 'm2m' || exemptReason == 'cmdb')
                        {
                            customInventoryTBR = true;
                        } else {
                            // base table
                            customInventoryFP = true;
                        }
                    }
                }  else if (isLegacyOOTB) 
                {
                    //res.tables.legacyOOTB[tableName] = getTableInfo(file);
                    if(checkInCustomTableInventory(tableName) == true)
                    {
                        customInventoryFP = true;
                    }
                } else if(isStoreApp)
                {
                    // we have verified this is NOT an OOTB Store app so add to custom list
                    res.tables.custom[tableName] = getTableInfo(file);
                    //res.tables.store[tableName] = getTableInfo(file);
                    if(checkInCustomTableInventory(tableName) == true)
                    {
                        customInventoryStore = true;
                    } else {
                        customInventoryFN = true;
                    }
                } else 
                {
                    res.tables.custom[tableName] = getTableInfo(file);
                    if(checkInCustomTableInventory(tableName) == false)
                    {
                        customInventoryFN = true;
                    }
                }
            } else {
                if(checkInCustomTableInventory(tableName) == true)
                {
                    customInventoryFP = true;
                } else if(tableName.substring(0,2) == 'u_' || tableName.substring(0,2) == 'x_') {
                    // log all u_ and x_ tables that are NOT custom or OOTB
                    res.tables.u[tableName] = getTableInfo(file);
                }   
            }

            if(isOOTB == true)
            {
                exemptReason = 'OOTB';
            }

            if(ignoreRecord)
            {
                //res.tables.ignored[tableName] = getTableInfo(file);
            }
        }

        if(!gs.nil(scopeName) && scopeName.indexOf('sn_') == 0)
        {
            scopeInfo.sn = true;
        }
        if(!gs.nil(scopeName) && scopeName.indexOf('x_' + LOCAL_COMPANY_CODE) == 0)
        {
            scopeInfo.x_local = true;
        }
        if(!gs.nil(scopeName) && scopeName.indexOf('x_snc') == 0)
        {
            scopeInfo.x_snc = true;
        }
        if(!gs.nil(scopeName) && scopeName.indexOf('x_') == 0)
        {
            scopeInfo.x = true;
        }
        if(gs.nil(scopeName) || scopeName == 'global')
        {
            scopeInfo.global = true;
        }

        // obfuscate customer created names
        if(scopeInfo.x_local)
        {
            scopeInfo.scopeName = "x_local_" + scopeID;
        }
        // inital the counters for the scope
        if(SHOW_SCOPES && !res.scopes.hasOwnProperty(scopeName))
        {
            res.scopes[scopeName] = initContainer();
        }

        incrementCounters(scopeInfo, className, 'total');
        if(ignoreRecord)
        {
            // ignored records (user created and deleted)
            incrementCounters(scopeInfo, className, 'ignored');
        } else if(isOOTB)
        {
            incrementCounters(scopeInfo, className, 'ootb');
            if(CHECK_CUSTOMIZED && isCustomized)
            {
                incrementCounters(scopeInfo, className, 'OOTBModified');
            }
        } else if(isExempt) {
            incrementCounters(scopeInfo, className, 'exempt');
            if(!gs.nil(tableName) && getFieldCount(tableName) > 50)
            {
                incrementCounters(scopeInfo, className, 'exempt50plus');
            }
        } else if(isStoreApp) {
            incrementCounters(scopeInfo, className, 'store');
            if(isStoreOOTB)
            {
                incrementCounters(scopeInfo, className, 'storeOOTB');
            } else {
                incrementCounters(scopeInfo, className, 'storeUserCreated');
            }
            if(CHECK_CUSTOMIZED && isCustomized)
            {
                incrementCounters(scopeInfo, className, 'storeModified');
            }
        } else if(isLegacyOOTB) {
            incrementCounters(scopeInfo, className, 'legacyOOTB');
            /*
            if(CHECK_CUSTOMIZED && isCustomized)
            {
                incrementCounters(scopeInfo, className, 'legacyOOTBModified');
            }
            */
        } else if(isMaint) {
            incrementCounters(scopeInfo, className, 'maintCreated');
            /*
            if(CHECK_CUSTOMIZED && isCustomized)
            {
                incrementCounters(scopeInfo, className, 'maintCreatedModified');
            }
            */
        } else {
            incrementCounters(scopeInfo, className, 'userCreated');
            if(!gs.nil(tableName) && getFieldCount(tableName) > 50)
            {
                incrementCounters(scopeInfo, className, 'userCreated50plus');
            }
        }

        if(customInventoryFP)
        {
            incrementCounters(scopeInfo, className, 'cifp');
            res.tables.fp[tableName] = getTableInfo(file);
        } else if (customInventoryFN)
        {
            incrementCounters(scopeInfo, className, 'cifn');
        } else if (customInventoryTBR)
        {
            incrementCounters(scopeInfo, className, 'citbr');
        } else if (customInventoryStore)
        {
            incrementCounters(scopeInfo, className, 'cis');
        } else if (checkInCustomTableInventory(file.ref_sys_db_object.name.toString()))
        {
            incrementCounters(scopeInfo, className, 'cic');
        }

        if(CHECK_CUSTOMIZED && isCustomized)
        {
            incrementCounters(scopeInfo, className, 'totalModified');
            if(isOOTB)
            {
                incrementCounters(scopeInfo, className, 'OOTBModified');
            } else if(isStoreApp) {
                incrementCounters(scopeInfo, className, 'storeModified');
            } else {
                incrementCounters(scopeInfo, className, 'userCreatedModified');
            }
        }

        // debug specifics
        /*
        if(ENABLE_DEBUG && !ignoreRecord && !isStoreApp && !scopeInfo.x && isOOTB == false && className == 'sys_db_object' && file.ref_sys_db_object.name.substring(0,2) != 'u_')
        {
            DEBUG_INFO.push(className + ' - ' + scopeName + ' - ' + file.ref_sys_db_object.name + ' - ' + isCustomized);
        }
        */

        var analyzeTime = GlideDateTime.subtract(analyzeStart, new GlideDateTime()).getNumericValue() / 1000;
        if(analyzeTime > 1)
        {
            this.TIMERS.push({'time': analyzeTime, 'name': 'Profile of ' + file.getDisplayValue()});
        }
    }

    if(SHOW_TABLES)
    {
        if(!SHOW_TABLES_IGNORED)
        {
            res.tables.ignored = null;
        }
    } else {
        // remove the table info
        res.tables = null;
    }

    for(var rct in REMOVED_CTI_TABLES)
    {
        res.tables.remove[REMOVED_CTI_TABLES[rct].name] = REMOVED_CTI_TABLES[rct];
    }

    for(var rgt in REMOVED_GF_TABLES)
    {
        res.tables.remove[REMOVED_GF_TABLES[rgt].name] = REMOVED_GF_TABLES[rgt];
    }

    // copy some numbers for easier reading
    res.customInventory.cifp = res.summary.total.count.cifp + INVALID_CUSTOM_TABLES.length;
    res.customInventory.cifn = res.summary.total.count.cifn;
    res.customInventory.cirgf = REMOVED_GF_TABLES.length;
    res.customInventory.cirt = REMOVED_CTI_TABLES.length;
    res.customInventory.cirgfms = GF_TABLES_MISSING_SUBSCRIPTION.length;
    res.customInventory.remove.unknown = res.summary.total.count.cifp - knownRemovedCount;
    res.customInventory.userCreated = Object.keys(res.tables.custom).length;
    res.customInventory.delta = res.customInventory.userCreated - res.customInventory.ua_custom_table_inventory;

    res.timers = TIMERS;
    res.issues = ISSUES;

    // remove unused data
    res.summary.global = null;
    res.summary.sn = null;
    res.summary.x_local = null;
    res.summary.x_snc = null;
    res.summary.x_external = null;
    res.tables.exempt = null;
    /*
    res.lobs = null;
    res.scopes = null;
    res.tables.customInventory = null;
    */
    
    if(MINIMIZE_OUTPUT == true)
    {
        OUTPUT_SPACER = '';
    }

    res.info.runTime = GlideDateTime.subtract(processStartTime, new GlideDateTime()).getNumericValue() / 1000;
    

    if (SAVE_RESULTS_FILE) {
        var someRecord = new GlideRecord('sys_user');
        someRecord.get('user_name', 'admin');
        var gsa = new GlideSysAttachment();
        var attachmentId = gsa.write(someRecord, "CTI Audit - " + res.info.instance + " - " + new GlideDateTime() + " - " + SCRIPT_VERSION + ".json", 'application/json', JSON.stringify(res, null, OUTPUT_SPACER));
        gs.info('Attachment: <a href="/sys_attachment.do?sys_id=' + attachmentId + '">' + attachmentId + '</a>');
    } else {
        // gs.info(JSON.stringify(res, null, rau.OUTPUT_SPACER).length); // debug payload size
        gs.info(JSON.stringify(res, null, OUTPUT_SPACER));
    }


    if(ENABLE_DEBUG)
    {
        DEBUG_INFO.sort();
        gs.info(JSON.stringify(DEBUG_INFO, null, OUTPUT_SPACER));
    }

    //gs.info(JSON.stringify(CACHE_HIT_COUNT, null, OUTPUT_SPACER));
})();