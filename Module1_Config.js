//Module1_Config.gs
/**
 * Core system configuration and constants
 */
const GRANT_CONFIG = {
  // Sheet names
  SHEETS: {
    GRANTS: 'Grants',
    NEW_GRANTS: 'New_Grants',
    DASHBOARD: 'Dashboard',
    GRANTWATCH_TAB: 'grantwatch',      
    GRANTS_GOV_TAB: 'grants.gov',      
    PROMPT_TEMPLATES: 'PromptTemplates',
    SYSTEM_MONITORING: 'System_Monitoring',
    FUNDER_INTELLIGENCE: 'Funder_Intelligence',
    COMPETITIVE_INTELLIGENCE: 'Competitive_Intelligence',
    SYSTEM_HEALTH: 'System_Health'
  },


  // Move BACKOFF to the TOP (before other modules load)
  BACKOFF: {
    BASE_MS: 1000,
    FACTOR: 2,
    JITTER_MS: 250,
    MAX_MS: 15000,
    MAX_RETRIES: 5
  },
 
  OPENAI: {
    MODEL: 'gpt-4o-mini',
    MAX_TOKENS: 2000,
    TEMPERATURE: 0.7,
    MAX_RETRIES: 3,
    RATE_LIMIT_DELAY: 2000
  },
 
  BATCH: {
    DISCOVERY_SIZE: 5,
    RESEARCH_SIZE: 10,
    ASSESSMENT_SIZE: 8,
    MAX_EXECUTION_TIME: 300000
  },
 
  VALIDATION: {
    MIN_GRANT_NAME_LENGTH: 3,
    MAX_GRANT_NAME_LENGTH: 200,
    MIN_AMOUNT: 500,
    MAX_AMOUNT: 5000000,
    REQUIRED_FIELDS: ['Grant_Name', 'Sponsor_Org', 'Status']
  },


  // ADD UNIFIED COLUMN MAPPINGS (your actual headers)
  COLUMNS: {
    GRANT_NAME: 'Grant_Name',
    DAYS_LEFT: 'Days_Left', 
    SPONSOR_ORG: 'Sponsor_Org',
    CONTACT_PERSON: 'Contact_Person',
    FOCUS_AREA: 'Focus_Area',
    AMOUNT: 'Amount',
    DEADLINE_EST: 'Deadline (Est.)',
    STATUS: 'Status',
    WOC_FOCUS_RATING: 'WOC_Focus_Rating',
    LEADERSHIP_DEV_ALIGNMENT: 'Leadership_Dev_Alignment',
    COMMUNITY_IMPACT_SCORE: 'Community_Impact_Score',
    BUSINESS_MATCH_PCT: 'Business_Match_Pct',
    SUCCESS_PROBABILITY: 'Success_Probability',
    COMPETITION_LEVEL: 'Competition_Level',
    LLC_PRIORITY_SCORE: 'LLC_Priority_Score',
    FOUNDATION_PRIORITY_SCORE: 'Foundation_Priority_Score',
    OVERALL_STRATEGIC_VALUE: 'Overall_Strategic_Value'
  }
};




// Get API key from secure storage
function getOpenAIApiKey() {
  return PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
}


// Central backoff policy for all retries
GRANT_CONFIG.BACKOFF = {
  BASE_MS: 1000,   // start delay
  FACTOR: 2,       // exponential factor
  JITTER_MS: 250,  // +/- jitter to avoid herd effects
  MAX_MS: 15000,   // cap per-try delay
  MAX_RETRIES: 5   // global retry ceiling (APIUtils respects this)
};
