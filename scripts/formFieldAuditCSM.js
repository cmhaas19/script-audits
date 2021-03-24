
var getFormFields = function(appPackage) {

	var pluginActive = true,
		formMap = {},
		fieldMap = {};

	if(appPackage.hasOwnProperty("plugin"))
		pluginActive = pm.isRegistered(appPackage.plugin);

	if(!pluginActive)
		return;

	var dictionaryLookup = (function(){
		var dictionaryEntries = {};

		var gr = new GlideRecord("sys_dictionary");
		gr.setWorkflow(false);
		gr.addEncodedQuery("nameINtask," + appPackage.tables.join(","));
		gr.query();

		while(gr.next()) {
			var element = gr.getValue("element");

			dictionaryEntries[element] = {
				table: gr.getValue("name"),
				element: element,
				glideType: gr.getValue("internal_type")
			};
		}
		
		return {
			find: function(elementName) {
				return dictionaryEntries[elementName];
			}
		};

	})();
	
	var gr = new GlideRecord("sys_ui_element");
	gr.setWorkflow(false);
	gr.addEncodedQuery("sys_ui_section.nameIN" + appPackage.tables.join(",") + "^" + appPackage.viewQuery);
	gr.query();

	while(gr.next()) {
		var element = dictionaryLookup.find(gr.getValue("element"));

		if(element) {
			var form = gr.sys_ui_section.name;

			if(formMap[form] == undefined)
				formMap[form] = {};

			if(formMap[form][element.glideType] == undefined)
				formMap[form][element.glideType] = true;	

			if(fieldMap[element.glideType] == undefined)
				fieldMap[element.glideType] = true;
		}
	}

	return {
		forms: formMap,
		fields: fieldMap
	};
};

var corePackage = {
	viewQuery: "sys_ui_section.view=Default view",
	tables: [
		"sys_user",
		"sys_user_group",
		"cmn_location",
		"core_company",
		"kb_knowledge"
	]
};

var csmPackage = {
	plugin: "com.sn_customerservice",
	viewQuery: "sys_ui_section.view=Default view^ORsys_ui_section.view.name=Case",
	tables: [
		"account_relationship",
		"alm_asset",
		"ast_contract",
		"cmdb_model",
		"csm_consumer",
		"csm_order",
		"csm_order_case",
		"csm_order_line_item",
		"customer_account",
		"customer_contact",
		"service_entitlement",
		"sn_customerservice_appointment",
		"sn_customerservice_case",
		"sn_customerservice_contact_relationship",
		"sn_customerservice_escalation",
		"sn_customerservice_m2m_asset_contact",
		"sn_customerservice_task",
		"sn_customerservice_team_member",
		"sn_shn_notes"
	]
}

var itsmPackage = {
	viewQuery: "sys_ui_section.view=Default view",
	tables: [
		"change_request",
		"incident",
		"incident_task",
		"problem",
		"task_ci",
		"task_sla",
		"sc_recurring_rollup",
		"sc_req_item",
		"sc_request",
		"sc_task",
		"sysapproval_approver",
		"sysapproval_group"
	]
};

var hrPackage = {
	plugin: "com.sn_hr_core",
	viewQuery: "sys_ui_section.view.name!=sp^ORsys_ui_section.view.nameISEMPTY",
	tables: [
		"sn_hr_core_case",
		"sn_hr_core_case_operations",
		"sn_hr_core_case_payroll",
		"sn_hr_core_case_relations",
		"sn_hr_core_case_talent_management",
		"sn_hr_core_case_total_rewards",
		"sn_hr_core_case_workforce_admin",
		"sn_hr_core_task",
		"sn_hr_le_case",
		"sn_hr_core_profile"
	]
};

var secOpsPackage = {
	plugin: "com.snc.security_incident",
	viewQuery: "sys_ui_section.view=Default view",
	tables: [
		"sn_si_attack_vector",
		"sn_si_audit_log",
		"sn_si_calculator",
		"sn_si_calculator_group",
		"sn_si_enrichment_firewall",
		"sn_si_enrichment_malware",
		"sn_si_enrichment_network_statistics",
		"sn_si_enrichment_running_processes",
		"sn_si_enrichment_running_service",
		"sn_si_feed_configuration",
		"sn_si_incident",
		"sn_si_incident_import",
		"sn_si_incident_template",
		"sn_si_m2m_incident_customerservice_case",
		"sn_si_m2m_incident_email_search",
		"sn_si_m2m_incident_enrichment",
		"sn_si_m2m_task_affected_user",
		"sn_si_pir_condition",
		"sn_si_process_definition",
		"sn_si_process_definition_selector",
		"sn_si_request",
		"sn_si_runbook_document",
		"sn_si_scan_request",
		"sn_si_severity_calculator",
		"sn_si_task",
		"sn_si_task_template",
		"sn_si_wf_activity_outcome_evaluator",
		"sn_ti_attack_mechanism",
		"sn_ti_attack_mode",
		"sn_ti_case",
		"sn_ti_case_ioc",
		"sn_ti_case_relationship_exclusion",
		"sn_ti_discovery_method",
		"sn_ti_feed",
		"sn_ti_indicator",
		"sn_ti_indicator_metadata",
		"sn_ti_indicator_type",
		"sn_ti_intended_effect",
		"sn_ti_ip_result",
		"sn_ti_lookup_result",
		"sn_ti_m2m_attack_mode_attack_mode",
		"sn_ti_m2m_case_task",
		"sn_ti_m2m_indicator_attack_mode",
		"sn_ti_m2m_indicator_indicator_type",
		"sn_ti_m2m_indicator_source",
		"sn_ti_m2m_ind_type_obs_type",
		"sn_ti_m2m_observables",
		"sn_ti_m2m_observable_indicator",
		"sn_ti_m2m_sighting_ci",
		"sn_ti_m2m_task_attack_mode",
		"sn_ti_m2m_task_indicator",
		"sn_ti_m2m_task_observable",
		"sn_ti_m2m_task_sighting",
		"sn_ti_malware_type",
		"sn_ti_observable",
		"sn_ti_observable_context_type",
		"sn_ti_observable_enrichment_result",
		"sn_ti_observable_source",
		"sn_ti_observable_type",
		"sn_ti_observable_type_category",
		"sn_ti_rate_limit",
		"sn_ti_scan",
		"sn_ti_scanner",
		"sn_ti_scanner_rate_limit",
		"sn_ti_scan_q_entry",
		"sn_ti_scan_result",
		"sn_ti_scan_type",
		"sn_ti_sighting",
		"sn_ti_sighting_search",
		"sn_ti_sighting_search_detail",
		"sn_ti_source",
		"sn_ti_supported_scan_type",
		"sn_ti_taxii_collection",
		"sn_ti_taxii_profile",
		"sn_ti_threat_actor_type",
		"sn_vul_async_vi_job",
		"sn_vul_async_vi_job_type",
		"sn_vul_calculator",
		"sn_vul_calculator_group",
		"sn_vul_change_approval",
		"sn_vul_ci_scan",
		"sn_vul_cwe",
		"sn_vul_discovery_model_software_match",
		"sn_vul_ds_import_q_entry",
		"sn_vul_entry",
		"sn_vul_grouping_rule",
		"sn_vul_integration",
		"sn_vul_integration_log",
		"sn_vul_integration_process",
		"sn_vul_integration_run",
		"sn_vul_int_data_src",
		"sn_vul_m2m_ci_services",
		"sn_vul_m2m_entry_cve",
		"sn_vul_m2m_entry_software",
		"sn_vul_m2m_item_task",
		"sn_vul_m2m_scan_configuration_item",
		"sn_vul_m2m_scan_source",
		"sn_vul_m2m_scan_vulnerability",
		"sn_vul_m2m_ttr_status",
		"sn_vul_m2m_vul_group_item",
		"sn_vul_nvd_entry",
		"sn_vul_nvd_repo",
		"sn_vul_rate_limit",
		"sn_vul_reference",
		"sn_vul_rollup",
		"sn_vul_sam_config",
		"sn_vul_scan",
		"sn_vul_scanner",
		"sn_vul_scanner_rate_limit",
		"sn_vul_scan_q_entry",
		"sn_vul_sched_import_pool",
		"sn_vul_software",
		"sn_vul_third_party_entry",
		"sn_vul_third_party_import_mapping",
		"sn_vul_ttr_rule",
		"sn_vul_update_manifest",
		"sn_vul_vgr_assignment_rule",
		"sn_vul_vi_ip_address",
		"sn_vul_vulnerability",
		"sn_vul_vulnerable_item"
	]
};

var results = {
	core: getFormFields(corePackage),
	itsm: getFormFields(itsmPackage),
	csm: getFormFields(csmPackage),
	hr: getFormFields(hrPackage),
	secOps: getFormFields(secOpsPackage)
};

gs.print(JSON.stringify(results));

