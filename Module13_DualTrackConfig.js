/**
 * MODULE 13: DUAL-TRACK CONFIGURATION (Header-Based)
 * Extends system with for-profit/nonprofit dual capabilities
 * - No hard-coded column letters
 * - Uses CoreUtils.createColumnMapping() on New_Grants
 * - Safe helpers for map/column access
 *
 * DEPENDS ON: GRANT_CONFIG, CoreUtils
 */

// EXTEND the main config instead of creating new one
GRANT_CONFIG.DUAL_TRACK = {
  VERSION: '2.0-DualTrack',

  // Organizational structures
  STRUCTURES: {
    LLC: 'Current LLC',
    FOUNDATION: 'Future Foundation',
    BOTH: 'Dual-Track',
    EITHER: 'Either Structure'
  },

  // Funding types for LLC track
  LLC_FUNDING_TYPES: {
    CORPORATE_PARTNERSHIP: 'Corporate Partnership',
    IMPACT_INVESTMENT: 'Impact Investment',
    GOVERNMENT_GRANT: 'Government Grant',
    ACCELERATOR: 'Accelerator',
    COMPETITION_PRIZE: 'Competition Prize'
  },

  // Priority levels for timing
  PRIORITY_LEVELS: {
    IMMEDIATE_LLC: 'Immediate (LLC)',
    FUTURE_FOUNDATION: 'Future (Foundation)',
    BOTH_TRACKS: 'Both Tracks',
    LATER_STAGE: 'Later Stage'
  },

  // Foundation timeline options
  FOUNDATION_TIMELINE: {
    YEAR_1: 'Year 1',
    YEAR_2: 'Year 2',
    YEAR_3_PLUS: 'Year 3+',
    DEPENDENT_ON_LLC: 'Dependent on LLC Success'
  },

  /**
   * Canonical header names (must match your New_Grants headers)
   * NOTE: These are header *strings*, not letters. Do not change unless your headers change.
   */
  HEADERS: {
    // Core existing
    GRANT_NAME: 'Grant_Name',
    DAYS_LEFT: 'Days_Left',
    SPONSOR_ORG: 'Sponsor_Org',
    CONTACT_PERSON: 'Contact_Person',
    FOCUS_AREA: 'Focus_Area',
    AMOUNT: 'Amount',
    DEADLINE_EST: 'Deadline (Est.)',
    STATUS: 'Status',
    DRAFT_PITCH: 'Draft_Pitch',
    REPORTING_REQ: 'reporting requirements',
    RENEWABLE: 'renewable',
    ELIGIBILITY_SUMMARY: 'Eligibility Summary',
    APPLICATION_LINK: 'Application Link',
    NOTES: 'Notes',
    DISCOVERY_SOURCE: 'Discovery_Source',
    SOURCE_RELIABILITY: 'Source_Reliability_Score',
    GEOGRAPHIC_SCOPE: 'Geographic_Scope',
    FUNDER_TYPE: 'Funder_Type',
    LAST_DISCOVERY_DATE: 'Last_Discovery_Date',

    // Existing scoring
    PRIORITY_SCORE: 'Priority_Score',
    BUSINESS_MATCH_PCT: 'Business_Match_Pct',          // 0–100 scale expected
    PREP_TIME_HOURS: 'Prep_Time_Hours',
    COMPLEXITY_RATING: 'Complexity_Rating',            // 1–10 expected
    SUCCESS_PROBABILITY: 'Success_Probability',        // 1–10 or 0–100 (your system uses 1–10)
    COMPETITION_LEVEL: 'Competition_Level',            // 1–10 (inverse in your assessment)
    COMMUNITY_IMPACT_SCORE: 'Community_Impact_Score',  // 1–10
    WOC_FOCUS_RATING: 'WOC_Focus_Rating',              // 1–10
    LEADERSHIP_DEV_ALIGNMENT: 'Leadership_Dev_Alignment', // 1–10

    // Existing tracking
    RESEARCH_COMPLETE: 'Research_Complete',
    APPLICATION_STARTED: 'Application_Started',
    DOCUMENTS_GATHERED: 'Documents_Gathered',
    APPLICATION_SUBMITTED: 'Application_Submitted',
    FOLLOW_UP_SENT: 'Follow_Up_Sent',
    RESPONSE_RECEIVED: 'Response_Received',
    AWARD_RECEIVED: 'Award_Received',
    DATE_ADDED: 'Date_Added',
    LAST_UPDATED: 'Last_Updated',

    // NEW Dual-Track fields (ensure SheetManager adds these to New_Grants)
    ELIGIBLE_FOR: 'Eligible_For',                        // LLC Only | 501c3 Only | Both | Either Structure
    STRUCTURE_RECOMMENDATION: 'Structure_Recommendation',// Current LLC | Future Foundation | Partnership Model
    CURRENT_PRIORITY: 'Current_Priority',                // Immediate (LLC) | Future (Foundation) | Both Tracks | Later Stage
    FOUNDATION_TIMELINE: 'Foundation_Timeline',          // Year 1 | Year 2 | Year 3+ | Dependent on LLC Success
    DUAL_OPPORTUNITY: 'Dual_Opportunity',                // Yes | No

    // LLC-specific factors (1–10)
    LLC_FUNDING_TYPE: 'LLC_Funding_Type',
    CORPORATE_CSR_ALIGNMENT: 'Corporate_CSR_Alignment',
    REVENUE_MODEL_FIT: 'Revenue_Model_Fit',
    SILICON_VALLEY_ADVANTAGE: 'Silicon_Valley_Advantage',
    BUSINESS_SCALABILITY_FOCUS: 'Business_Scalability_Focus',
    PARTNERSHIP_POTENTIAL: 'Partnership_Potential',

    // Foundation-specific factors (1–10)
    NONPROFIT_PROGRAM_FIT: 'Nonprofit_Program_Fit',
    RESEARCH_COMPONENT_VALUE: 'Research_Component_Value',
    COMMUNITY_OUTREACH_ALIGNMENT: 'Community_Outreach_Alignment',

    // Synergy factors (1–10)
    LLC_FOUNDATION_SYNERGY: 'LLC_Foundation_Synergy',
    CREDIBILITY_BUILDING: 'Credibility_Building',
    PILOT_PROGRAM_POTENTIAL: 'Pilot_Program_Potential',

    // Calculated scores
    LLC_PRIORITY_SCORE: 'LLC_Priority_Score',
    FOUNDATION_PRIORITY_SCORE: 'Foundation_Priority_Score',
    OVERALL_STRATEGIC_VALUE: 'Overall_Strategic_Value'
  },

  // Scoring weights
  SCORING_WEIGHTS: {
    LLC: {
      EXISTING_WOC: 0.15,
      EXISTING_LEADERSHIP: 0.10,
      EXISTING_BUSINESS_MATCH: 0.10,   // Business_Match_Pct (0–100)
      REVENUE_MODEL_FIT: 0.25,         // 1–10
      CORPORATE_CSR_ALIGNMENT: 0.20,   // 1–10
      SILICON_VALLEY_ADVANTAGE: 0.10,  // 1–10
      PARTNERSHIP_POTENTIAL: 0.10      // 1–10
    },
    FOUNDATION: {
      EXISTING_WOC: 0.20,              // 1–10
      EXISTING_COMMUNITY: 0.20,        // 1–10
      EXISTING_LEADERSHIP: 0.15,       // 1–10
      NONPROFIT_PROGRAM_FIT: 0.20,     // 1–10
      RESEARCH_COMPONENT: 0.10,        // 1–10
      COMMUNITY_OUTREACH: 0.10,        // 1–10
      LLC_SYNERGY: 0.05                // 1–10
    }
  },

  // Bonus points
  BONUS_POINTS: {
    BOTH_ELIGIBLE: 15,
    IMMEDIATE_PRIORITY: 10,
    CORPORATE_PARTNERSHIP: 10,
    HIGH_SV_ADVANTAGE: 5,
    HIGH_PILOT_POTENTIAL: 10,
    HIGH_CREDIBILITY_BUILDING: 8,
    HIGH_SYNERGY: 5
  },

  // Thresholds
  THRESHOLDS: {
    LLC_QUICK_WIN: 80,
    FOUNDATION_PIPELINE: 75,
    STRATEGIC_VALUE: 80,
    HIGH_RATING: 7,
    EXCELLENT_RATING: 8
  }
}; // End of GRANT_CONFIG.DUAL_TRACK extension

// ===== Helpers (Module 13) =====
const DualTrack = (function () {
  let _map = null;
  let _sheet = null;

  function sheet() {
    if (_sheet) return _sheet;
    const name = (GRANT_CONFIG && GRANT_CONFIG.SHEETS && GRANT_CONFIG.SHEETS.NEW_GRANTS) || 'New_Grants';
    _sheet = CoreUtils.getSheetSafely(name);
    return _sheet;
  }

  function map() {
    if (_map) return _map;
    _map = CoreUtils.createColumnMapping(sheet());
    return _map;
  }

  function col(header) {
    const m = map();
    const idx = m[header];
    return (idx === undefined) ? -1 : (idx + 1); // 1-based or -1 if missing
  }

  function validateHeaders(requiredHeaders) {
    const m = map();
    const missing = requiredHeaders.filter(h => m[h] === undefined);
    if (missing.length) {
      Logger.log('⚠️ DualTrack missing headers: ' + missing.join(', '));
      return { ok: false, missing: missing };
    }
    return { ok: true, missing: [] };
  }

  function dropdownValues() {
    return {
      ELIGIBLE_FOR: ['LLC Only', '501c3 Only', 'Both', 'Either Structure'],
      STRUCTURE_RECOMMENDATION: ['Current LLC', 'Future Foundation', 'Partnership Model'],
      CURRENT_PRIORITY: ['Immediate (LLC)', 'Future (Foundation)', 'Both Tracks', 'Later Stage'],
      FOUNDATION_TIMELINE: ['Year 1', 'Year 2', 'Year 3+', 'Dependent on LLC Success'],
      DUAL_OPPORTUNITY: ['Yes', 'No'],
      LLC_FUNDING_TYPE: ['Corporate Partnership', 'Impact Investment', 'Government Grant', 'Accelerator', 'Competition Prize']
    };
  }

  function logSummary() {
    const H = GRANT_CONFIG.DUAL_TRACK.HEADERS;
    Logger.log('📊 DUAL-TRACK CONFIGURATION SUMMARY');
    Logger.log('Version: ' + GRANT_CONFIG.DUAL_TRACK.VERSION);
    Logger.log('Sheet: ' + sheet().getName());
    const test = [H.PRIORITY_SCORE, H.WOC_FOCUS_RATING, H.LEADERSHIP_DEV_ALIGNMENT, H.COMMUNITY_IMPACT_SCORE];
    const res = validateHeaders(test);
    Logger.log('Key headers present: ' + (res.ok ? 'Yes' : 'No'));
    if (!res.ok) Logger.log('Missing: ' + res.missing.join(', '));
  }

  return {
    sheet, map, col, validateHeaders, dropdownValues, logSummary
  };
})();

/**
 * Quick validation entry
 */
function validateDualTrackConfig() {
  const H = GRANT_CONFIG.DUAL_TRACK.HEADERS;
  const required = [
    H.GRANT_NAME, H.PRIORITY_SCORE, H.WOC_FOCUS_RATING, H.LEADERSHIP_DEV_ALIGNMENT, H.COMMUNITY_IMPACT_SCORE,
    H.BUSINESS_MATCH_PCT,
    H.LLC_PRIORITY_SCORE, H.FOUNDATION_PRIORITY_SCORE, H.OVERALL_STRATEGIC_VALUE
  ];
  const r = DualTrack.validateHeaders(required);
  Logger.log(r.ok ? '✅ Dual-track configuration validated.' : '❌ Dual-track configuration missing headers.');
  DualTrack.logSummary();
  return r.ok;
}

/**
 * Export dropdown values for SheetManager to use when adding validations.
 */
function getDualTrackDropdownValues() {
  return DualTrack.dropdownValues();
}