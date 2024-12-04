const RecommenderConstants = {};

// When a license weight crosses this value, it will be applied regardless if all heuristics have completed
RecommenderConstants.LICENSE_THRESHOLD = 999;
RecommenderConstants.BASE_VALUE = 100;
RecommenderConstants.FALLBACK_LICENSE = "FALLBACK_LICENSE";
RecommenderConstants.EXCLUDED = "EXCLUDED_TABLE";
RecommenderConstants.MISSING_SERVICENOW_TABLE = "MISSING_SERVICENOW_TABLE";
RecommenderConstants.MISSING_SUBSCRIPTION_NAME = "MISSING_SUBSCRIPTION_NAME";

// Glide properties
RecommenderConstants.FALLBACK_LICENSE_WEIGHT = 0;
RecommenderConstants.DECAY = 0;
RecommenderConstants.NUM_RECOMMENDATIONS = 10;
RecommenderConstants.MAX_PASS_ITERATIONS = 100;

/*
    Table that drives the license calculation.
    List order is the source code
    Weight is how much this heuristic adds to a license, IE how important a signal is it
*/
RecommenderConstants.RELATION_CODES = {
  assignment: 0, // assignment field
  subscription: 1, // subscription field
  extension: 2, // extension
  referenceTo: 3, // referring field
  referenceFrom: 4, // reference field
  relationTo: 5, // relationship to
  relationFrom: 6, // relationship from
  flowAction: 7, // flow action
  flowTrigger: 8 // flow is trigger
};

RecommenderConstants.RELATION_DETAILS = {
  [RecommenderConstants.RELATION_CODES.assignment]: {
    weight: RecommenderConstants.LICENSE_THRESHOLD + 1,
    label: "assigned license"
  },
  [RecommenderConstants.RELATION_CODES.subscription]: {
    weight: RecommenderConstants.LICENSE_THRESHOLD + 1,
    label: "subscription"
  },
  [RecommenderConstants.RELATION_CODES.extension]: {
    weight: RecommenderConstants.LICENSE_THRESHOLD + 1,
    label: "extension"
  },
  [RecommenderConstants.RELATION_CODES.referenceTo]: {
    weight: RecommenderConstants.BASE_VALUE,
    label: "reference to this table"
  },
  [RecommenderConstants.RELATION_CODES.referenceFrom]: {
    weight: RecommenderConstants.BASE_VALUE * 0.5,
    label: "reference from this table"
  },
  [RecommenderConstants.RELATION_CODES.relationTo]: {
    weight: RecommenderConstants.BASE_VALUE * 0.9,
    label: "relationship to this table"
  },
  [RecommenderConstants.RELATION_CODES.relationFrom]: {
    weight: RecommenderConstants.BASE_VALUE * 0.5,
    label: "relationship from this table"
  },
  [RecommenderConstants.RELATION_CODES.flowAction]: {
    weight: RecommenderConstants.BASE_VALUE * 0.75,
    label: "flow action"
  },
  [RecommenderConstants.RELATION_CODES.flowTrigger]: {
    weight: RecommenderConstants.BASE_VALUE * 1.5,
    label: "flow trigger"
  }
};

RecommenderConstants.REASONS = {
  ASSIGNMENT: "ASSIGNMENT",
  SUBSCRIPTION: "SUBSCRIPTION",
  EXTENDS: "EXTENDS",
  EXCLUDED: "EXCLUDED",
  RELATION_OOTB: "RELATION_OOTB",
  RELATION_CUSTOM: "RELATION_CUSTOM",
  DEFAULT: "DEFAULT"
};

RecommenderConstants.REASON_TEXTS = {
  ASSIGNMENT: "The customer already assigned a license to this table.",
  SUBSCRIPTION:
    "The table is in a scope or package with the recommended license.",
  DEFAULT:
    "Custom tables that are not associated with other licensed applications should use the App Engine license. We did not find a relationship from this table to other licensed objects or applications. As a result we recommend using the App Engine Standalone license.",
  EXTENDS: "This table extends table ({0}) that has the recommended license.",
  EXCLUDED:
    "This table was found in the Custom Table Inventory (ua_custom_table_inventory) but does not appear to be customer created. The customer does not need to assign a license to this table because it was created by ServiceNow, created by a vendor on the customer's behalf, or for another similar reason. The customer should delete this entry from the Custom Table Inventory.",

  RELATION:
    "We recommend this license based on {0} relationship chain(s) for this table.",
  RELATION_OOTB:
    "This table is related to an out-of-the-box ServiceNow table ({0}) that has this license through the following path : {1}",
  RELATION_CUSTOM:
    "This table is related to a table defined by the customer ({0}) that has this license through the following path : {1}"
};

module.exports = {
  RecommenderConstants
};