/**
 * MODULE 16: DUAL-TRACK MENU INTEGRATION (Module16_DualTrackMenuIntegration.gs)
 * FIXED VERSION - Now includes ALL original menu items + dual-track enhancements
 * Extends your existing Module10_MenuSystem.gs with dual-track capabilities
 * Adds new menu items while preserving all existing functionality
 */

// ====================
// ENHANCED MENU SYSTEM
// ====================

/**
 * Enhanced onOpen function that preserves your existing menu and adds dual-track
 * This is the COMPLETE version with ALL original menu items included
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
    
  try {
    // Create main Grant Management menu (preserves your existing structure)
    const mainMenu = ui.createMenu('🎯 Grant Management');
      
    // ===== CORE SETUP =====
    mainMenu.addItem('🔧 Setup System', 'setupGrantsManagement');
    mainMenu.addSeparator();
    
    // ===== AI TOOLS SUBMENU (RESTORED FROM MODULE10) =====
    const aiToolsMenu = ui.createMenu('🤖 AI Tools');
    aiToolsMenu.addItem('🔐 Setup OpenAI Key', 'setupOpenAIAPIKey');
    aiToolsMenu.addSeparator();
    aiToolsMenu.addItem('🔍 Basic Discovery', 'autoDiscoverGrants');
    aiToolsMenu.addItem('🎯 Enhanced Discovery', 'expandedDiscovery');
    aiToolsMenu.addItem('🔬 Research Grants', 'researchGrants');
    aiToolsMenu.addItem('🎯 Assess Grants', 'assessGrants');
    aiToolsMenu.addSeparator();
    aiToolsMenu.addItem('🏛️ Foundation Search', 'searchSpecificFoundation');
    aiToolsMenu.addItem('💰 Amount Range Search', 'searchByAmountRange');
    aiToolsMenu.addItem('📍 Geographic Search', 'searchGeographicFocus');
    aiToolsMenu.addItem('👥 Demographic Search', 'searchDemographicFocus');
    mainMenu.addSubMenu(aiToolsMenu);
    
    // ===== CORE WORKFLOW (RESTORED FROM MODULE10) =====
    mainMenu.addItem('📥 Merge New Grants to Main', 'mergeNewGrantsToMain');
    mainMenu.addItem('🚀 Generate Pitches', 'generatePitches');
    mainMenu.addSeparator();
    
    // ===== SYSTEM HEALTH SUBMENU (RESTORED FROM MODULE10) =====
    const systemHealthMenu = ui.createMenu('🛡️ System Health');
    systemHealthMenu.addItem('📊 Run Health Check', 'runSystemHealthCheck');
    systemHealthMenu.addItem('🔧 Validate All Systems', 'validateAllSystems');
    systemHealthMenu.addItem('🧹 Clean System Logs', 'cleanSystemLogs');
    systemHealthMenu.addItem('📤 Export System Data', 'exportSystemData');
    systemHealthMenu.addSeparator();
    systemHealthMenu.addItem('🔍 System Diagnostic', 'diagnoseAndFixSystem');
    systemHealthMenu.addItem('🔄 Fix Menu Issues', 'fixMenuSystem');
    mainMenu.addSubMenu(systemHealthMenu);
    
    // ===== UNADVERTISED FINDER SUBMENU (RESTORED FROM MODULE10) =====
    const unadvertisedMenu = ui.createMenu('🔍 Unadvertised Finder');
    unadvertisedMenu.addItem('🔧 Setup Finder', 'setupUnadvertisedFinder');
    unadvertisedMenu.addItem('📋 Import from 990 Paste', 'importFundersFrom990Paste');
    unadvertisedMenu.addItem('✨ Enrich Selected Lead', 'enrichSelectedLead');
    unadvertisedMenu.addItem('📊 Generate Weekly Digest', 'generateUnadvertisedDigest');
    mainMenu.addSubMenu(unadvertisedMenu);
    
    mainMenu.addSeparator();
      
    // ===== DUAL-TRACK ANALYSIS SUBMENU (ENHANCED) =====
    const dualTrackMenu = ui.createMenu('🚀 Dual-Track Analysis')
      .addItem('🏢 Find LLC Quick Wins', 'findEnhancedLLCQuickWins')
      .addItem('🎯 Find Dual-Track Opportunities', 'findDualTrackOpportunities')
      .addItem('🏛️ Build Foundation Pipeline', 'buildFoundationPipeline')
      .addItem('💰 Track Monthly Grants', 'trackMonthlyGrants')
      .addSeparator()
      .addItem('📊 Complete Analysis Report', 'generateDualTrackReport')
      .addSeparator()
      .addItem('🔄 Update Dual-Track Scores', 'updateAllDualTrackScores')
      .addItem('🔧 Validate Dual-Track Setup', 'validateDualTrackSetup');
      
    // Add dual-track submenu to main menu
    mainMenu.addSubMenu(dualTrackMenu);
      
    // ===== SYSTEM TOOLS SUBMENU (ENHANCED) =====
    const systemMenu = ui.createMenu('⚙️ System Tools')
      .addItem('🔧 Validate Configuration', 'validateAllSystems')
      .addItem('🎨 Setup Conditional Formatting', 'setupDualTrackFormatting')
      .addItem('📋 System Health Check', 'performSystemHealthCheck')
      .addItem('❓ Show System Help', 'showDualTrackHelp');
      
    mainMenu.addSubMenu(systemMenu);
      
    // Add separator and help
    mainMenu.addSeparator()
      .addItem('❓ Help & Documentation', 'showDualTrackHelp');
      
    // Add to spreadsheet UI
    mainMenu.addToUi();
      
    console.log('✅ Enhanced dual-track menu system loaded successfully with ALL features');
      
  } catch (error) {
    console.error('❌ Error loading menu system:', error);
    // Fallback: create basic menu
    ui.createMenu('Grant Management - Basic')
      .addItem('🔄 Update Scores', 'updateAllDualTrackScores')
      .addItem('🚀 Find Opportunities', 'findEnhancedLLCQuickWins')
      .addToUi();
  }
}

// ====================
// ALL WRAPPER FUNCTIONS FOR MENU ACCESS
// ====================

// AI Tools functions (restored from Module10)
function setupOpenAIAPIKey() {
  try {
    if (typeof APIUtils !== 'undefined' && APIUtils.setupOpenAIKey) {
      return APIUtils.setupOpenAIKey();
    } else {
      SpreadsheetApp.getUi().alert('Setup OpenAI Key', 'APIUtils module is loading... Please try again in a moment.');
    }
  } catch (error) {
    console.log('Error in setupOpenAIAPIKey:', error.message);
  }
}

function expandedDiscovery() {
  try {
    if (typeof AdvancedSearch !== 'undefined' && AdvancedSearch.expandedDiscovery) {
      return AdvancedSearch.expandedDiscovery();
    } else {
      SpreadsheetApp.getUi().alert('Enhanced Discovery', 'AdvancedSearch module is loading...');
    }
  } catch (error) {
    console.log('Error in expandedDiscovery:', error.message);
  }
}

function searchSpecificFoundation() {
  try {
    if (typeof AdvancedSearch !== 'undefined' && AdvancedSearch.searchSpecificFoundation) {
      return AdvancedSearch.searchSpecificFoundation();
    } else {
      SpreadsheetApp.getUi().alert('Foundation Search', 'AdvancedSearch module is loading...');
    }
  } catch (error) {
    console.log('Error in searchSpecificFoundation:', error.message);
  }
}

function searchByAmountRange() {
  try {
    if (typeof AdvancedSearch !== 'undefined' && AdvancedSearch.searchByAmountRange) {
      return AdvancedSearch.searchByAmountRange();
    } else {
      SpreadsheetApp.getUi().alert('Amount Search', 'AdvancedSearch module is loading...');
    }
  } catch (error) {
    console.log('Error in searchByAmountRange:', error.message);
  }
}

function searchGeographicFocus() {
  try {
    if (typeof AdvancedSearch !== 'undefined' && AdvancedSearch.searchByGeography) {
      return AdvancedSearch.searchByGeography([]);
    } else {
      SpreadsheetApp.getUi().alert('Geographic Search', 'AdvancedSearch module is loading...');
    }
  } catch (error) {
    console.log('Error in searchGeographicFocus:', error.message);
  }
}

function searchDemographicFocus() {
  try {
    if (typeof AdvancedSearch !== 'undefined' && AdvancedSearch.searchByDemographics) {
      return AdvancedSearch.searchByDemographics([]);
    } else {
      SpreadsheetApp.getUi().alert('Demographic Search', 'AdvancedSearch module is loading...');
    }
  } catch (error) {
    console.log('Error in searchDemographicFocus:', error.message);
  }
}

// Core workflow functions (restored from Module10)
function mergeNewGrantsToMain() {
  try {
    if (typeof SheetManager !== 'undefined' && SheetManager.mergeNewGrantsToMain) {
      return SheetManager.mergeNewGrantsToMain();
    } else {
      SpreadsheetApp.getUi().alert('Merge Grants', 'SheetManager module is loading...');
    }
  } catch (error) {
    console.log('Error in mergeNewGrantsToMain:', error.message);
  }
}

function generatePitches() {
  try {
    if (typeof PitchGeneration !== 'undefined' && PitchGeneration.generatePitches) {
      return PitchGeneration.generatePitches();
    } else {
      SpreadsheetApp.getUi().alert('Generate Pitches', 'PitchGeneration module is loading...');
    }
  } catch (error) {
    console.log('Error in generatePitches:', error.message);
  }
}

// System Health functions (restored from Module10)
function runSystemHealthCheck() {
  try {
    if (typeof SystemHealth !== 'undefined' && SystemHealth.runHealthCheck) {
      return SystemHealth.runHealthCheck();
    } else {
      console.log('SystemHealth not available, running diagnostic...');
      diagnoseAndFixSystem();
    }
  } catch (error) {
    console.log('Error in runSystemHealthCheck:', error.message);
  }
}

function validateAllSystems() {
  try {
    if (typeof SystemHealth !== 'undefined' && SystemHealth.validateAllSystems) {
      return SystemHealth.validateAllSystems();
    } else {
      console.log('Running module availability test...');
      testModuleAvailability();
    }
  } catch (error) {
    console.log('Error in validateAllSystems:', error.message);
  }
}

function cleanSystemLogs() {
  try {
    if (typeof SystemHealth !== 'undefined' && SystemHealth.cleanLogs) {
      return SystemHealth.cleanLogs();
    } else {
      SpreadsheetApp.getUi().alert('Clean Logs', 'SystemHealth module is loading...');
    }
  } catch (error) {
    console.log('Error in cleanSystemLogs:', error.message);
  }
}

function exportSystemData() {
  try {
    if (typeof SystemHealth !== 'undefined' && SystemHealth.exportSystemData) {
      return SystemHealth.exportSystemData();
    } else {
      SpreadsheetApp.getUi().alert('Export Data', 'SystemHealth module is loading...');
    }
  } catch (error) {
    console.log('Error in exportSystemData:', error.message);
  }
}

function fixMenuSystem() {
  try {
    // Recreate the enhanced menu system
    onOpen();
    
    SpreadsheetApp.getUi().alert(
      '✅ Menu System Fixed!',
      'Your complete Grant Management system has been restored!\\n\\n' +
      'You now have access to:\\n' +
      '🤖 AI Tools\\n' +
      '🛡️ System Health\\n' +
      '🔍 Unadvertised Finder\\n' +
      '🚀 Dual-Track Analysis\\n' +
      '⚙️ System Tools\\n\\n' +
      'Refresh your browser if needed.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
    console.log('✅ Menu system fixed successfully');
    
  } catch (error) {
    console.log('❌ Menu fix failed:', error.message);
  }
}

// Unadvertised Finder functions (restored from Module10)
function setupUnadvertisedFinder() {
  try {
    if (typeof UnadvertisedFinder !== 'undefined' && UnadvertisedFinder.setupUnadvertisedFinder) {
      return UnadvertisedFinder.setupUnadvertisedFinder();
    } else {
      SpreadsheetApp.getUi().alert('Setup Finder', 'UnadvertisedFinder module is loading...');
    }
  } catch (error) {
    console.log('Error in setupUnadvertisedFinder:', error.message);
  }
}

function importFundersFrom990Paste() {
  try {
    if (typeof UnadvertisedFinder !== 'undefined' && UnadvertisedFinder.importFundersFrom990Paste) {
      return UnadvertisedFinder.importFundersFrom990Paste();
    } else {
      SpreadsheetApp.getUi().alert('Import Funders', 'UnadvertisedFinder module is loading...');
    }
  } catch (error) {
    console.log('Error in importFundersFrom990Paste:', error.message);
  }
}

function enrichSelectedLead() {
  try {
    if (typeof UnadvertisedFinder !== 'undefined' && UnadvertisedFinder.enrichSelectedLead) {
      return UnadvertisedFinder.enrichSelectedLead();
    } else {
      SpreadsheetApp.getUi().alert('Enrich Lead', 'UnadvertisedFinder module is loading...');
    }
  } catch (error) {
    console.log('Error in enrichSelectedLead:', error.message);
  }
}

function generateUnadvertisedDigest() {
  try {
    if (typeof UnadvertisedFinder !== 'undefined' && UnadvertisedFinder.generateWeeklyDigest) {
      return UnadvertisedFinder.generateWeeklyDigest();
    } else {
      SpreadsheetApp.getUi().alert('Generate Digest', 'UnadvertisedFinder module is loading...');
    }
  } catch (error) {
    console.log('Error in generateUnadvertisedDigest:', error.message);
  }
}

// Dual-track menu wrapper functions (existing)
function findEnhancedLLCQuickWins() {
  return DualTrackAnalysis.findLLCQuickWins();
}

function findDualTrackOpportunities() {
  return DualTrackAnalysis.findDualTrackOpportunities();
}

function buildFoundationPipeline() {
  return DualTrackAnalysis.buildFoundationPipeline();
}

function generateDualTrackReport() {
  return DualTrackAnalysis.generateComprehensiveReport();
}

function trackMonthlyGrants() {
  return DualTrackAnalysis.trackMonthlyGrants();
}

function updateAllDualTrackScores() {
  try {
    if (typeof DualTrackScoring !== 'undefined' && DualTrackScoring.updateAllScores) {
      return DualTrackScoring.updateAllScores();
    } else {
      SpreadsheetApp.getUi().alert('Update Scores', 'DualTrackScoring module is loading...');
    }
  } catch (error) {
    console.log('Error in updateAllDualTrackScores:', error.message);
  }
}

/**
 * Validate dual-track system setup
 */
function validateDualTrackSetup() {
  console.log('🔧 VALIDATING DUAL-TRACK SYSTEM SETUP');
  console.log('====================================');
    
  try {
    // Validate configuration
    const configValid = validateDualTrackConfig();
      
    // Validate scoring system
    const scoringValid = DualTrackScoring.validateScoring();
      
    // Check for required columns
    const columnsValid = validateRequiredColumns();
      
    // Overall system health
    const systemHealthy = configValid && scoringValid && columnsValid;
      
    if (systemHealthy) {
      console.log('✅ DUAL-TRACK SYSTEM VALIDATION COMPLETE');
      console.log('All systems are functioning properly!');
      console.log('');
      console.log('🎯 Ready to use:');
      console.log('   - Enhanced LLC scoring');
      console.log('   - Foundation pipeline planning');
      console.log('   - Dual-track strategic analysis');
      console.log('   - Monthly grant tracking');
    } else {
      console.log('⚠️ VALIDATION ISSUES DETECTED');
      console.log('Please check the errors above and resolve before proceeding.');
    }
      
    return systemHealthy;
      
  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  }
}

function setupDualTrackFormatting() {
  try {
    if (typeof setupDualTrackFormatting !== 'undefined') {
      return setupDualTrackFormatting();
    } else {
      SpreadsheetApp.getUi().alert('Setup Formatting', 'Dual-track formatting is loading...');
    }
  } catch (error) {
    console.log('Error in setupDualTrackFormatting:', error.message);
  }
}

function performSystemHealthCheck() {
  try {
    if (typeof SystemHealth !== 'undefined' && SystemHealth.runHealthCheck) {
      return SystemHealth.runHealthCheck();
    } else {
      console.log('Running enhanced health check...');
      runSystemHealthCheck();
    }
  } catch (error) {
    console.log('Error in performSystemHealthCheck:', error.message);
  }
}

function showDualTrackHelp() {
  console.log('❓ ELEVATED MOVEMENTS DUAL-TRACK SYSTEM HELP');
  console.log('============================================');
  console.log('');
    
  console.log('🎯 SYSTEM OVERVIEW:');
  console.log('==================');
  console.log('The dual-track system extends your existing grant management');
  console.log('capabilities to support both LLC (for-profit) and future');
  console.log('Foundation (nonprofit) funding opportunities.');
  console.log('');
    
  console.log('🤖 AI TOOLS FEATURES:');
  console.log('=====================');
  console.log('   🔐 Setup OpenAI Key - Configure AI integration');
  console.log('   🔍 Basic Discovery - Core grant discovery');
  console.log('   🎯 Enhanced Discovery - Advanced AI-powered search');
  console.log('   🔬 Research Grants - AI-powered grant research');
  console.log('   🎯 Assess Grants - Intelligent grant assessment');
  console.log('   🏛️ Foundation Search - Targeted foundation search');
  console.log('   💰 Amount Range Search - Search by funding amount');
  console.log('   📍 Geographic Search - Location-based search');
  console.log('   👥 Demographic Search - Target demographic funding');
  console.log('');
    
  console.log('🛡️ SYSTEM HEALTH FEATURES:');
  console.log('==========================');
  console.log('   📊 Run Health Check - Comprehensive system diagnostics');
  console.log('   🔧 Validate All Systems - System validation');
  console.log('   🧹 Clean System Logs - Maintenance and cleanup');
  console.log('   📤 Export System Data - Data backup and export');
  console.log('   🔍 System Diagnostic - Advanced diagnostics');
  console.log('');
    
  console.log('🔍 UNADVERTISED FINDER FEATURES:');
  console.log('================================');
  console.log('   🔧 Setup Finder - Initialize 990 parsing system');
  console.log('   📋 Import from 990 Paste - Parse foundation 990 forms');
  console.log('   ✨ Enrich Selected Lead - AI-powered lead enrichment');
  console.log('   📊 Generate Weekly Digest - Automated reporting');
  console.log('');
    
  console.log('🚀 DUAL-TRACK ANALYSIS FEATURES:');
  console.log('================================');
  console.log('   🏢 Find LLC Quick Wins - Immediate for-profit opportunities');
  console.log('   🎯 Find Dual-Track Opportunities - Maximum leverage funding');
  console.log('   🏛️ Build Foundation Pipeline - Future nonprofit grants');
  console.log('   💰 Track Monthly Grants - Recurring opportunity tracking');
  console.log('   📊 Complete Analysis Report - Comprehensive strategic overview');
  console.log('   🔄 Update Dual-Track Scores - Recalculate enhanced scores');
  console.log('   🔧 Validate Dual-Track Setup - Check configuration');
  console.log('');
    
  console.log('✅ Your system now includes ALL features from the original system');
  console.log('   PLUS the enhanced dual-track capabilities!');
}

// Test module availability function
function testModuleAvailability() {
  const modules = {
    'GRANT_CONFIG': typeof GRANT_CONFIG !== 'undefined',
    'CoreUtils': typeof CoreUtils !== 'undefined',
    'DateUtils': typeof DateUtils !== 'undefined',
    'APIUtils': typeof APIUtils !== 'undefined',
    'SheetManager': typeof SheetManager !== 'undefined',
    'GrantDiscovery': typeof GrantDiscovery !== 'undefined',
    'GrantAssessment': typeof GrantAssessment !== 'undefined',
    'PitchGeneration': typeof PitchGeneration !== 'undefined',
    'SystemHealth': typeof SystemHealth !== 'undefined',
    'UnadvertisedFinder': typeof UnadvertisedFinder !== 'undefined',
    'AdvancedSearch': typeof AdvancedSearch !== 'undefined',
    'DualTrackAnalysis': typeof DualTrackAnalysis !== 'undefined'
  };

  const missing = Object.entries(modules)
    .filter(([name, available]) => !available)
    .map(([name]) => name);

  return {
    allLoaded: missing.length === 0,
    missing: missing,
    loadedCount: Object.keys(modules).length - missing.length,
    totalCount: Object.keys(modules).length
  };
}