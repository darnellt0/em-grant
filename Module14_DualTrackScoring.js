/**
 * MODULE 14: DUAL-TRACK SCORING SYSTEM - PRODUCTION READY
 * Refactored for performance, reliability, and maintainability
 * Author: AI Assistant for Elevated Movements
 * Version: 2.1-Production
 */


// ====================
// CONFIGURATION CONSTANTS
// ====================


const ELEVATED_CONFIG = {
  SHEET_NAME: 'New_Grants',
  
  // Use unified column mappings from main config
  COLUMNS: GRANT_CONFIG.COLUMNS,


  
  // Scoring weights
  WEIGHTS: {
    LLC: {
      WOC_FOCUS: 0.25,
      LEADERSHIP_DEV: 0.20,
      BUSINESS_MATCH: 0.25,
      SUCCESS_PROB: 0.15,
      COMPETITION: 0.10,
      SOURCE_RELIABILITY: 0.05
    },
    FOUNDATION: {
      WOC_FOCUS: 0.30,
      LEADERSHIP_DEV: 0.25,
      COMMUNITY_IMPACT: 0.25,
      SUCCESS_PROB: 0.10,
      COMPETITION: 0.10
    }
  },
  
  // Scoring thresholds
  THRESHOLDS: {
    EXCELLENT: 9,
    HIGH: 7,
    MEDIUM: 5,
    MIN_VIABLE: 40,
    MAX_SCORE: 100
  },
  
  // Bonus points
  BONUSES: {
    HIGH_RELIABILITY: 5,
    LOCAL_ADVANTAGE: 3,
    CORPORATE_FUNDER: 4,
    FOUNDATION_FUNDER: 2,
    LOW_COMPETITION: 5,
    EXCELLENT_WOC: 8,
    EXCELLENT_LEADERSHIP: 6,
    PERFECT_MISSION_ALIGNMENT: 10,
    EXCELLENT_MISSION_ALIGNMENT: 5,
    HIGH_BUSINESS_MATCH: 3,
    HIGH_COMMUNITY_IMPACT: 3
  }
};


// ====================
// CORE SCORING ENGINE
// ====================


class GrantScoringEngine {
  constructor() {
    this.sheet = null;
    this.columnIndices = new Map();
    this.initialized = false;
  }


  /**
   * Initialize the scoring engine with sheet and column mappings
   */
  initialize() {
    try {
      this.sheet = this.getSheet();
      if (!this.sheet) {
        throw new Error('Cannot access New_Grants sheet');
      }


      this.buildColumnIndices();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize scoring engine:', error);
      return false;
    }
  }


  /**
   * Get the New_Grants sheet safely
   */
  getSheet() {
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = spreadsheet.getSheetByName(ELEVATED_CONFIG.SHEET_NAME);
      
      if (!sheet) {
        throw new Error(`Sheet "${ELEVATED_CONFIG.SHEET_NAME}" not found`);
      }
      
      return sheet;
    } catch (error) {
      console.error('❌ Error accessing sheet:', error);
      return null;
    }
  }


  /**
   * Build column index mapping for efficient access
   */
  buildColumnIndices() {
    try {
      const headers = this.sheet.getRange(1, 1, 1, this.sheet.getLastColumn()).getValues()[0];
      
      // Map each configured column to its index
      Object.entries(ELEVATED_CONFIG.COLUMNS).forEach(([key, columnName]) => {
        const index = headers.indexOf(columnName);
        if (index !== -1) {
          this.columnIndices.set(key, index + 1); // Convert to 1-based
        } else {
          console.warn(`⚠️ Column "${columnName}" not found`);
        }
      });


      console.log(`✅ Mapped ${this.columnIndices.size} columns`);
    } catch (error) {
      console.error('❌ Error building column indices:', error);
      throw error;
    }
  }


  /**
   * Safely get numeric value from cell
   */
  getNumericValue(row, columnKey, defaultValue = 0) {
    try {
      const colIndex = this.columnIndices.get(columnKey);
      if (!colIndex) return defaultValue;


      const value = this.sheet.getRange(row, colIndex).getValue();
      
      if (typeof value === 'number' && !isNaN(value)) {
        return value;
      }
      
      // Try to parse as number
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    } catch (error) {
      console.error(`Error getting ${columnKey} from row ${row}:`, error);
      return defaultValue;
    }
  }


  /**
   * Safely get string value from cell
   */
  getStringValue(row, columnKey, defaultValue = '') {
    try {
      const colIndex = this.columnIndices.get(columnKey);
      if (!colIndex) return defaultValue;


      const value = this.sheet.getRange(row, colIndex).getValue();
      return String(value || defaultValue).trim();
    } catch (error) {
      console.error(`Error getting ${columnKey} from row ${row}:`, error);
      return defaultValue;
    }
  }


  /**
   * Set value in cell safely
   */
  setValue(row, columnKey, value) {
    try {
      const colIndex = this.columnIndices.get(columnKey);
      if (!colIndex) {
        console.warn(`Cannot set ${columnKey} - column not found`);
        return false;
      }


      this.sheet.getRange(row, colIndex).setValue(value);
      return true;
    } catch (error) {
      console.error(`Error setting ${columnKey} in row ${row}:`, error);
      return false;
    }
  }


  /**
   * Calculate LLC Priority Score
   */
  calculateLLCScore(row) {
    try {
      const weights = ELEVATED_CONFIG.WEIGHTS.LLC;
      
      // Get core factors
      const wocFocus = this.getNumericValue(row, 'WOC_FOCUS');
      const leadershipDev = this.getNumericValue(row, 'LEADERSHIP_DEV');
      const businessMatch = this.getNumericValue(row, 'BUSINESS_MATCH');
      const successProb = this.getNumericValue(row, 'SUCCESS_PROB');
      const competition = this.getNumericValue(row, 'COMPETITION');
      const sourceReliability = this.getNumericValue(row, 'SOURCE_RELIABILITY');


      // Calculate weighted base score
      let score = (
        (weights.WOC_FOCUS * wocFocus * 10) +
        (weights.LEADERSHIP_DEV * leadershipDev * 10) +
        (weights.BUSINESS_MATCH * businessMatch) + // Already 0-100 scale
        (weights.SUCCESS_PROB * successProb * 10) +
        (weights.COMPETITION * (10 - competition) * 10) + // Inverted
        (weights.SOURCE_RELIABILITY * sourceReliability * 10)
      );


      // Add LLC-specific bonuses
      score += this.calculateLLCBonuses(row);


      return Math.min(Math.round(score), ELEVATED_CONFIG.THRESHOLDS.MAX_SCORE);
    } catch (error) {
      console.error(`Error calculating LLC score for row ${row}:`, error);
      return 0;
    }
  }


  /**
   * Calculate Foundation Priority Score
   */
  calculateFoundationScore(row) {
    try {
      const weights = ELEVATED_CONFIG.WEIGHTS.FOUNDATION;
      
      // Get core factors
      const wocFocus = this.getNumericValue(row, 'WOC_FOCUS');
      const leadershipDev = this.getNumericValue(row, 'LEADERSHIP_DEV');
      const communityImpact = this.getNumericValue(row, 'COMMUNITY_IMPACT');
      const successProb = this.getNumericValue(row, 'SUCCESS_PROB');
      const competition = this.getNumericValue(row, 'COMPETITION');


      // Calculate weighted base score
      let score = (
        (weights.WOC_FOCUS * wocFocus * 10) +
        (weights.LEADERSHIP_DEV * leadershipDev * 10) +
        (weights.COMMUNITY_IMPACT * communityImpact * 10) +
        (weights.SUCCESS_PROB * successProb * 10) +
        (weights.COMPETITION * (10 - competition) * 10) // Inverted
      );


      // Add foundation-specific bonuses
      score += this.calculateFoundationBonuses(row);


      return Math.min(Math.round(score), ELEVATED_CONFIG.THRESHOLDS.MAX_SCORE);
    } catch (error) {
      console.error(`Error calculating Foundation score for row ${row}:`, error);
      return 0;
    }
  }


  /**
   * Calculate Overall Strategic Value
   */
  calculateStrategicValue(row) {
    try {
      const llcScore = this.calculateLLCScore(row);
      const foundationScore = this.calculateFoundationScore(row);


      // Weight foundation slightly higher for mission alignment
      let strategicValue = (llcScore * 0.45) + (foundationScore * 0.55);


      // Mission alignment bonuses
      const wocFocus = this.getNumericValue(row, 'WOC_FOCUS');
      const leadershipDev = this.getNumericValue(row, 'LEADERSHIP_DEV');


      if (wocFocus >= ELEVATED_CONFIG.THRESHOLDS.EXCELLENT && 
          leadershipDev >= ELEVATED_CONFIG.THRESHOLDS.EXCELLENT) {
        strategicValue += ELEVATED_CONFIG.BONUSES.PERFECT_MISSION_ALIGNMENT;
      } else if (wocFocus >= ELEVATED_CONFIG.THRESHOLDS.HIGH && 
                 leadershipDev >= ELEVATED_CONFIG.THRESHOLDS.HIGH) {
        strategicValue += ELEVATED_CONFIG.BONUSES.EXCELLENT_MISSION_ALIGNMENT;
      }


      return Math.min(Math.round(strategicValue), ELEVATED_CONFIG.THRESHOLDS.MAX_SCORE);
    } catch (error) {
      console.error(`Error calculating strategic value for row ${row}:`, error);
      return 0;
    }
  }


  /**
   * Calculate LLC-specific bonus points
   */
  calculateLLCBonuses(row) {
    let bonuses = 0;
    const B = ELEVATED_CONFIG.BONUSES;
    const T = ELEVATED_CONFIG.THRESHOLDS;


    try {
      // High source reliability
      const sourceReliability = this.getNumericValue(row, 'SOURCE_RELIABILITY');
      if (sourceReliability >= T.EXCELLENT) {
        bonuses += B.HIGH_RELIABILITY;
      }


      // Geographic advantage
      const geoScope = this.getStringValue(row, 'GEOGRAPHIC_SCOPE');
      if (['Local', 'Regional'].includes(geoScope)) {
        bonuses += B.LOCAL_ADVANTAGE;
      }


      // Corporate funder bonus
      const funderType = this.getStringValue(row, 'FUNDER_TYPE');
      if (funderType === 'Corporate') {
        bonuses += B.CORPORATE_FUNDER;
      }


      // Low competition bonus
      const competition = this.getNumericValue(row, 'COMPETITION');
      if (competition <= 3) {
        bonuses += B.LOW_COMPETITION;
      }


      // High business match bonus
      const businessMatch = this.getNumericValue(row, 'BUSINESS_MATCH');
      if (businessMatch >= 80) {
        bonuses += B.HIGH_BUSINESS_MATCH;
      }


    } catch (error) {
      console.error(`Error calculating LLC bonuses for row ${row}:`, error);
    }


    return bonuses;
  }


  /**
   * Calculate Foundation-specific bonus points
   */
  calculateFoundationBonuses(row) {
    let bonuses = 0;
    const B = ELEVATED_CONFIG.BONUSES;
    const T = ELEVATED_CONFIG.THRESHOLDS;


    try {
      // Foundation funder bonus
      const funderType = this.getStringValue(row, 'FUNDER_TYPE');
      if (funderType === 'Foundation') {
        bonuses += B.FOUNDATION_FUNDER;
      }


      // Excellent WOC focus
      const wocFocus = this.getNumericValue(row, 'WOC_FOCUS');
      if (wocFocus >= T.EXCELLENT) {
        bonuses += B.EXCELLENT_WOC;
      }


      // Excellent leadership development
      const leadershipDev = this.getNumericValue(row, 'LEADERSHIP_DEV');
      if (leadershipDev >= T.EXCELLENT) {
        bonuses += B.EXCELLENT_LEADERSHIP;
      }


      // Low competition bonus
      const competition = this.getNumericValue(row, 'COMPETITION');
      if (competition <= 3) {
        bonuses += B.LOW_COMPETITION;
      }


      // High community impact
      const communityImpact = this.getNumericValue(row, 'COMMUNITY_IMPACT');
      if (communityImpact >= T.HIGH) {
        bonuses += B.HIGH_COMMUNITY_IMPACT;
      }


    } catch (error) {
      console.error(`Error calculating Foundation bonuses for row ${row}:`, error);
    }


    return bonuses;
  }


  /**
   * Process all grants and update scores
   */
  processAllGrants() {
    if (!this.initialized && !this.initialize()) {
      throw new Error('Scoring engine not initialized');
    }


    const lastRow = this.sheet.getLastRow();
    if (lastRow <= 1) {
      return { success: 0, errors: 0, message: 'No data to process' };
    }


    let successCount = 0;
    let errorCount = 0;
    const results = [];


    console.log(`🔄 Processing ${lastRow - 1} grants...`);


    // Process each row
    for (let row = 2; row <= lastRow; row++) {
      try {
        const grantName = this.getStringValue(row, 'GRANT_NAME');
        
        // Skip empty rows
        if (!grantName) {
          continue;
        }


        // Calculate scores
        const llcScore = this.calculateLLCScore(row);
        const foundationScore = this.calculateFoundationScore(row);
        const strategicValue = this.calculateStrategicValue(row);


        // Update the sheet
        const updates = [
          this.setValue(row, 'LLC_SCORE', llcScore),
          this.setValue(row, 'FOUNDATION_SCORE', foundationScore),
          this.setValue(row, 'STRATEGIC_VALUE', strategicValue)
        ];


        if (updates.every(Boolean)) {
          successCount++;
          results.push({
            row,
            grant: grantName,
            scores: { llc: llcScore, foundation: foundationScore, strategic: strategicValue }
          });
        } else {
          errorCount++;
          console.error(`❌ Failed to update scores for row ${row}`);
        }


        // Progress logging
        if (successCount % 10 === 0 && successCount > 0) {
          console.log(`✅ Processed ${successCount} grants...`);
        }


      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing row ${row}:`, error);
      }
    }


    return {
      success: successCount,
      errors: errorCount,
      results: results,
      message: `Processed ${successCount} grants successfully`
    };
  }


  /**
   * Get detailed breakdown for a specific grant
   */
  getGrantBreakdown(row) {
    if (!this.initialized && !this.initialize()) {
      return null;
    }


    try {
      return {
        grant: this.getStringValue(row, 'GRANT_NAME'),
        sponsor: this.getStringValue(row, 'SPONSOR_ORG'),
        scores: {
          llc: this.calculateLLCScore(row),
          foundation: this.calculateFoundationScore(row),
          strategic: this.calculateStrategicValue(row)
        },
        factors: {
          wocFocus: this.getNumericValue(row, 'WOC_FOCUS'),
          leadershipDev: this.getNumericValue(row, 'LEADERSHIP_DEV'),
          communityImpact: this.getNumericValue(row, 'COMMUNITY_IMPACT'),
          businessMatch: this.getNumericValue(row, 'BUSINESS_MATCH'),
          successProb: this.getNumericValue(row, 'SUCCESS_PROB'),
          competition: this.getNumericValue(row, 'COMPETITION')
        },
        metadata: {
          funderType: this.getStringValue(row, 'FUNDER_TYPE'),
          geoScope: this.getStringValue(row, 'GEOGRAPHIC_SCOPE'),
          sourceReliability: this.getNumericValue(row, 'SOURCE_RELIABILITY')
        }
      };
    } catch (error) {
      console.error(`Error getting breakdown for row ${row}:`, error);
      return null;
    }
  }


  /**
   * Validate system setup
   */
  validateSetup() {
    try {
      if (!this.initialize()) {
        return { valid: false, message: 'Failed to initialize' };
      }


      // Check required columns
      const requiredColumns = ['GRANT_NAME', 'WOC_FOCUS', 'LEADERSHIP_DEV', 'LLC_SCORE', 'FOUNDATION_SCORE', 'STRATEGIC_VALUE'];
      const missingColumns = requiredColumns.filter(col => !this.columnIndices.has(col));


      if (missingColumns.length > 0) {
        return {
          valid: false,
          message: `Missing required columns: ${missingColumns.join(', ')}`
        };
      }


      // Test with sample data if available
      if (this.sheet.getLastRow() > 1) {
        const testBreakdown = this.getGrantBreakdown(2);
        if (testBreakdown) {
          return {
            valid: true,
            message: 'System validated successfully',
            sampleGrant: testBreakdown.grant,
            sampleScores: testBreakdown.scores
          };
        }
      }


      return { valid: true, message: 'System ready for data' };
    } catch (error) {
      return { valid: false, message: error.toString() };
    }
  }
}


// ====================
// GLOBAL INSTANCE
// ====================


const GrantScorer = new GrantScoringEngine();


// ====================
// PUBLIC API FUNCTIONS
// ====================


/**
 * Update all dual-track scores - Main function
 */
function updateAllDualTrackScores() {
  console.log('🚀 STARTING DUAL-TRACK SCORE UPDATE');
  console.log('===================================');
  
  try {
    const result = GrantScorer.processAllGrants();
    
    console.log('✅ SCORING COMPLETE');
    console.log(`Successfully updated: ${result.success} grants`);
    if (result.errors > 0) {
      console.log(`⚠️ Errors: ${result.errors}`);
    }


    // Show user-friendly alert
    if (result.success > 0) {
      try {
        SpreadsheetApp.getUi().alert(
          'Scoring Complete!',
          `Successfully updated dual-track scores for ${result.success} grants.\n\n` +
          'Check your LLC_Priority_Score, Foundation_Priority_Score, and Overall_Strategic_Value columns.',
          SpreadsheetApp.getUi().AlertType.INFO
        );
      } catch (uiError) {
        console.log('✅ Scoring complete (UI alert unavailable)');
      }
    }


    return result;


  } catch (error) {
    console.error('❌ Critical error:', error);
    
    try {
      SpreadsheetApp.getUi().alert(
        'Scoring Failed',
        `Error: ${error.message}\n\nCheck the execution logs for details.`,
        SpreadsheetApp.getUi().AlertType.ERROR
      );
    } catch (uiError) {
      console.error('❌ Failed to show error dialog');
    }
    
    throw error;
  }
}


/**
 * Get detailed breakdown for a specific grant
 */
function getGrantScoringBreakdown(row) {
  return GrantScorer.getGrantBreakdown(row);
}


/**
 * Calculate individual scores (for backward compatibility)
 */
function calculateLLCPriorityScore(row) {
  return GrantScorer.calculateLLCScore(row);
}


function calculateFoundationPriorityScore(row) {
  return GrantScorer.calculateFoundationScore(row);
}


function calculateOverallStrategicValue(row) {
  return GrantScorer.calculateStrategicValue(row);
}


// ====================
// LEGACY COMPATIBILITY
// ====================


/**
 * Backward compatibility functions
 */


function getColumnIndex(columnName) {
  const sheet = GrantScorer.getSheet();
  if (!sheet) return -1;
  
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const index = headers.indexOf(columnName);
    return index === -1 ? -1 : index + 1;
  } catch (error) {
    return -1;
  }
}


function getDualTrackSheetSafely() {
  return GrantScorer.getSheet();
}


function validateDualTrackColumns() {
  const validation = GrantScorer.validateSetup();
  return validation.valid;
}
