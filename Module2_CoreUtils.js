//Module2_CoreUtils.gs
/**
 * Core utility functions used throughout the system
 */
const CoreUtils = {
 
  getSpreadsheetSafely() {
    try {
      return SpreadsheetApp.getActiveSpreadsheet();
    } catch (error) {
      throw new Error(`Cannot access spreadsheet: ${error.message}`);
    }
  },

  getSheetSafely(sheetName) {
    const ss = this.getSpreadsheetSafely();
    const sheet = ss.getSheetByName(sheetName);
   
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found. Please run setup first.`);
    }
   
    return sheet;
  },

  createColumnMapping(sheet) {
    try {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const mapping = {};
     
      headers.forEach((header, index) => {
        if (header && header.toString().trim()) {
          mapping[header.toString().trim()] = index;
        }
      });
     
      return mapping;
    } catch (error) {
      throw new Error(`Failed to create column mapping: ${error.message}`);
    }
  },

  validateRequiredColumns(columnMapping, requiredColumns) {
    const missing = requiredColumns.filter(col => columnMapping[col] === undefined);
   
    if (missing.length > 0) {
      throw new Error(`Missing required columns: ${missing.join(', ')}`);
    }
   
    return true;
  },

  cleanString(str) {
    if (!str) return '';
    return str.toString().trim().replace(/\s+/g, ' ');
  },

  isValidURL(string) {
    if (!string) return false;
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  },

  executeWithRetry(operation, func, maxRetries = 2, delay = 1000) {
    // Safe access to config with fallback defaults
    const backoff = (typeof GRANT_CONFIG !== 'undefined' && GRANT_CONFIG.BACKOFF) ? 
      GRANT_CONFIG.BACKOFF : {
        BASE_MS: 1000,
        FACTOR: 2,
        JITTER_MS: 250,
        MAX_MS: 15000,
        MAX_RETRIES: 5
      };
    
    let lastError;

    for (let attempt = 1; attempt <= (maxRetries + 1); attempt++) {
      try {
        Logger.log(`🔄 ${operation} (attempt ${attempt}/${maxRetries + 1})`);
        const result = func();
        if (attempt > 1) Logger.log(`✅ ${operation} succeeded on retry`);
        return { success: true, data: result, attempts: attempt };
      } catch (error) {
        lastError = error;
        Logger.log(`❌ ${operation} attempt ${attempt} failed: ${error.message}`);
        if (attempt <= maxRetries) {
          const base = Math.min(delay * (backoff.FACTOR || 2), backoff.MAX_MS || 15000);
          const jitterAmt = backoff.JITTER_MS || 0;
          const jitter = Math.floor((Math.random() * 2 * jitterAmt) - jitterAmt);
          const nextDelay = Math.max(0, base + jitter);
          Logger.log(`⏳ Waiting ${nextDelay}ms before retry...`);
          Utilities.sleep(nextDelay);
          delay = base; // grow delay for the next loop
        }
      }
    }
    throw new Error(`${operation} failed after ${maxRetries + 1} attempts: ${lastError.message}`);
  },

  logSystemEvent(event, status, details) {
    try {
      const ss = this.getSpreadsheetSafely();
      let monitoringSheet = ss.getSheetByName('System_Monitoring');
     
      if (!monitoringSheet) {
        monitoringSheet = ss.insertSheet('System_Monitoring');
        monitoringSheet.getRange(1, 1, 1, 4).setValues([
          ['Timestamp', 'Event', 'Status', 'Details']
        ]);
        monitoringSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
      }
     
      const lastRow = monitoringSheet.getLastRow() + 1;
      monitoringSheet.getRange(lastRow, 1, 1, 4).setValues([
        [new Date(), event, status, details]
      ]);
     
    } catch (error) {
      Logger.log(`Failed to log system event: ${error.message}`);
    }
  },

  /**
   * Get unified column index safely
   */
  getUnifiedColumn(sheet, columnKey) {
    try {
      if (!GRANT_CONFIG.COLUMNS[columnKey]) {
        Logger.log(`⚠️ Column key ${columnKey} not found in config`);
        return -1;
      }
      
      const columnName = GRANT_CONFIG.COLUMNS[columnKey];
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const index = headers.indexOf(columnName);
      return index === -1 ? -1 : index + 1; // Convert to 1-based
    } catch (error) {
      Logger.log(`❌ Error getting column ${columnKey}: ${error.message}`);
      return -1;
    }
  },

  /**
   * Check if required modules are loaded
   */
  checkModuleDependencies(requiredModules) {
    const missing = [];
    
    requiredModules.forEach(moduleName => {
      if (typeof window[moduleName] === 'undefined' && typeof this[moduleName] === 'undefined') {
        missing.push(moduleName);
      }
    });
    
    if (missing.length > 0) {
      Logger.log(`⚠️ Missing modules: ${missing.join(', ')}`);
      return false;
    }
    
    return true;
  }
};

/**
 * MISSING HELPER FUNCTIONS
 * Add these functions to fix the health check errors
 * You can add these to Module2_CoreUtils.gs or create a new Module17_HelperFunctions.gs
 */

/**
 * Get the main grants sheet safely
 */
function getMainGrantsSheet() {
  try {
    const sheetName = (GRANT_CONFIG && GRANT_CONFIG.SHEETS && GRANT_CONFIG.SHEETS.NEW_GRANTS) || 'New_Grants';
    return CoreUtils.getSheetSafely(sheetName);
  } catch (error) {
    Logger.log(`❌ Error getting main grants sheet: ${error.message}`);
    return null;
  }
}

/**
 * Get all dual-track columns from unified config
 */
function getAllDualTrackColumns() {
  try {
    // Use the unified column mappings from GRANT_CONFIG
    if (GRANT_CONFIG && GRANT_CONFIG.COLUMNS) {
      return GRANT_CONFIG.COLUMNS;
    }
    
    // Fallback to dual-track headers if available
    if (GRANT_CONFIG && GRANT_CONFIG.DUAL_TRACK && GRANT_CONFIG.DUAL_TRACK.HEADERS) {
      return GRANT_CONFIG.DUAL_TRACK.HEADERS;
    }
    
    // Last resort - return basic columns
    return {
      GRANT_NAME: 'Grant_Name',
      WOC_FOCUS_RATING: 'WOC_Focus_Rating',
      LEADERSHIP_DEV_ALIGNMENT: 'Leadership_Dev_Alignment',
      COMMUNITY_IMPACT_SCORE: 'Community_Impact_Score',
      LLC_PRIORITY_SCORE: 'LLC_Priority_Score',
      FOUNDATION_PRIORITY_SCORE: 'Foundation_Priority_Score',
      OVERALL_STRATEGIC_VALUE: 'Overall_Strategic_Value'
    };
  } catch (error) {
    Logger.log(`❌ Error getting dual-track columns: ${error.message}`);
    return {};
  }
}

/**
 * Column letter to number converter
 */
function columnToNumber(column) {
  if (typeof column === 'number') return column;
  if (!column || typeof column !== 'string') return 1;
  
  let result = 0;
  for (let i = 0; i < column.length; i++) {
    result = result * 26 + (column.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return result;
}

/**
 * Simplified DualTrackScoring object for compatibility
 */
const DualTrackScoring = {
  /**
   * Calculate LLC score (simplified version)
   */
  calculateLLCScore(row) {
    try {
      const sheet = getMainGrantsSheet();
      if (!sheet) return 0;
      
      const columns = getAllDualTrackColumns();
      
      // Get basic scoring factors using CoreUtils.getUnifiedColumn
      const wocFocus = this.getSafeValue(sheet, row, 'WOC_FOCUS_RATING') || 0;
      const leadership = this.getSafeValue(sheet, row, 'LEADERSHIP_DEV_ALIGNMENT') || 0;
      const businessMatch = this.getSafeValue(sheet, row, 'BUSINESS_MATCH_PCT') || 0;
      
      // Simple weighted calculation
      const score = (wocFocus * 25) + (leadership * 20) + (businessMatch * 0.25);
      return Math.min(Math.round(score), 100);
      
    } catch (error) {
      Logger.log(`❌ Error calculating LLC score: ${error.message}`);
      return 0;
    }
  },
  
  /**
   * Calculate Foundation score (simplified version)
   */
  calculateFoundationScore(row) {
    try {
      const sheet = getMainGrantsSheet();
      if (!sheet) return 0;
      
      const wocFocus = this.getSafeValue(sheet, row, 'WOC_FOCUS_RATING') || 0;
      const leadership = this.getSafeValue(sheet, row, 'LEADERSHIP_DEV_ALIGNMENT') || 0;
      const community = this.getSafeValue(sheet, row, 'COMMUNITY_IMPACT_SCORE') || 0;
      
      // Simple weighted calculation for foundation
      const score = (wocFocus * 30) + (leadership * 25) + (community * 25);
      return Math.min(Math.round(score), 100);
      
    } catch (error) {
      Logger.log(`❌ Error calculating Foundation score: ${error.message}`);
      return 0;
    }
  },
  
  /**
   * Safe value getter
   */
  getSafeValue(sheet, row, columnKey) {
    try {
      if (CoreUtils && CoreUtils.getUnifiedColumn) {
        const colIndex = CoreUtils.getUnifiedColumn(sheet, columnKey);
        if (colIndex > 0) {
          const value = sheet.getRange(row, colIndex).getValue();
          return (typeof value === 'number' && !isNaN(value)) ? value : 0;
        }
      }
      
      // Fallback: try to find column by name
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const colIndex = headers.indexOf(columnKey);
      if (colIndex !== -1) {
        const value = sheet.getRange(row, colIndex + 1).getValue();
        return (typeof value === 'number' && !isNaN(value)) ? value : 0;
      }
      
      return 0;
    } catch (error) {
      Logger.log(`❌ Error getting safe value for ${columnKey}: ${error.message}`);
      return 0;
    }
  },
  
  /**
   * Validate scoring system
   */
  validateScoring() {
    try {
      const sheet = getMainGrantsSheet();
      if (!sheet) {
        Logger.log('❌ Cannot validate scoring - no sheet access');
        return false;
      }
      
      if (sheet.getLastRow() > 1) {
        const testScore = this.calculateLLCScore(2);
        Logger.log(`✅ Scoring validation test: ${testScore}`);
        return true;
      } else {
        Logger.log('ℹ️ No data to test scoring with');
        return true;
      }
    } catch (error) {
      Logger.log(`❌ Scoring validation error: ${error.message}`);
      return false;
    }
  }
};

/**
 * Update all dual-track scores (simplified version)
 */
function updateAllDualTrackScores() {
  try {
    Logger.log('🚀 Starting dual-track score update...');
    
    const sheet = getMainGrantsSheet();
    if (!sheet) {
      Logger.log('❌ Cannot access grants sheet');
      return { success: 0, errors: 1 };
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      Logger.log('ℹ️ No data to process');
      return { success: 0, errors: 0 };
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let row = 2; row <= lastRow; row++) {
      try {
        const grantName = sheet.getRange(row, 1).getValue();
        if (!grantName) continue;
        
        const llcScore = DualTrackScoring.calculateLLCScore(row);
        const foundationScore = DualTrackScoring.calculateFoundationScore(row);
        const strategicValue = Math.round((llcScore + foundationScore) / 2);
        
        // Try to update score columns if they exist
        const columns = getAllDualTrackColumns();
        if (CoreUtils && CoreUtils.getUnifiedColumn) {
          const llcCol = CoreUtils.getUnifiedColumn(sheet, 'LLC_PRIORITY_SCORE');
          const foundationCol = CoreUtils.getUnifiedColumn(sheet, 'FOUNDATION_PRIORITY_SCORE');
          const strategicCol = CoreUtils.getUnifiedColumn(sheet, 'OVERALL_STRATEGIC_VALUE');
          
          if (llcCol > 0) sheet.getRange(row, llcCol).setValue(llcScore);
          if (foundationCol > 0) sheet.getRange(row, foundationCol).setValue(foundationScore);
          if (strategicCol > 0) sheet.getRange(row, strategicCol).setValue(strategicValue);
        }
        
        successCount++;
        
      } catch (error) {
        Logger.log(`❌ Error updating row ${row}: ${error.message}`);
        errorCount++;
      }
    }
    
    Logger.log(`✅ Score update complete: ${successCount} success, ${errorCount} errors`);
    return { success: successCount, errors: errorCount };
    
  } catch (error) {
    Logger.log(`❌ Critical error in score update: ${error.message}`);
    return { success: 0, errors: 1 };
  }
}