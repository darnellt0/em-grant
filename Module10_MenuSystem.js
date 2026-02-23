/**
 * UPDATED MENU SYSTEM - Module10_MenuSystem.gs Enhanced
 * Integrates real grant discovery into your existing menu structure
 */

/**
 * ENHANCED createMenus function - adds real grant discovery options
 */
function createMenus() {
  const ui = SpreadsheetApp.getUi();

  // Main Grant Management Menu (Enhanced with Real Discovery)
  ui.createMenu('📊 Grant Management')
    .addItem('🔧 Setup System', 'setupGrantsManagement')
    .addSeparator()
    .addSubMenu(ui.createMenu('🔍 Grant Discovery')
      .addItem('🎯 Real Current Grants (RECOMMENDED)', 'findRealCurrentGrants')
      .addItem('🚀 Traditional AI Discovery', 'autoDiscoverGrants') 
      .addSeparator()
      .addItem('🧪 Test Real Grant System', 'testRealGrantDiscovery')
      .addSeparator()
      .addItem('🎯 Enhanced Discovery (Multi-Strategy)', 'expandedDiscovery')
      .addItem('🏛️ Search Specific Foundation', 'searchSpecificFoundation')
      .addItem('💰 Search by Amount Range', 'searchByAmountRange')
      .addItem('📍 Geographic Focus (CA/Bay Area)', 'searchGeographicFocus')
      .addItem('👥 Women of Color Focus', 'searchDemographicFocus'))
    .addItem('🔬 Research Grants', 'researchGrants')
    .addItem('🔬 Research Existing Grants', 'researchExistingGrants')
    .addItem('🎯 Assess Grants', 'assessGrants')
    .addSeparator()
    .addItem('📥 Merge New Grants to Main', 'mergeNewGrantsToMain')
    .addItem('📊 Generate Summary Dashboard', 'generateSummaryDashboard')
    .addItem('🧹 Clean Duplicate Grants', 'cleanDuplicateGrants')
    .addToUi();

  // AI Tools Menu (Enhanced)
  ui.createMenu('🤖 AI Tools')
    .addItem('🔐 Setup OpenAI Key', 'setupOpenAIKey')
    .addSeparator()
    .addItem('🔍 Discover Grants', 'autoDiscoverGrants')
    .addItem('🎯 Find Real Current Grants', 'findRealCurrentGrants')
    .addItem('🔬 Research Grants', 'researchGrants')
    .addItem('🎯 Assess Grants', 'assessGrants')
    .addItem('✍️ Generate Pitches', 'generatePitches')
    .addSeparator()
    .addItem('🧪 Test API Connection', 'testAPIConnection')
    .addToUi();

  // Dual-Track Analysis Menu (Enhanced with Real Data)
  ui.createMenu('🎯 Dual-Track Analysis')
    .addItem('🔧 Update All Dual-Track Scores', 'updateAllDualTrackScores')
    .addItem('🧪 Validate Dual-Track Setup', 'validateDualTrackSetup')
    .addSeparator()
    .addItem('💼 Find LLC Quick Wins', 'findEnhancedLLCQuickWins')
    .addItem('🏛️ Build Foundation Pipeline', 'buildFoundationPipeline')
    .addItem('🎯 Find Dual-Track Opportunities', 'findDualTrackOpportunities')
    .addItem('🔄 Track Monthly Grants', 'trackMonthlyGrants')
    .addSeparator()
    .addItem('📊 Generate Comprehensive Report', 'generateDualTrackReport')
    .addItem('🧪 Test Analysis with Current Data', 'testDualTrackAnalysisDetailed')
    .addToUi();

  // Advanced Search Menu
  ui.createMenu('🔍 Advanced Search')
    .addItem('🚀 Enhanced Multi-Strategy Discovery', 'expandedDiscovery')
    .addSeparator()
    .addItem('🏛️ Foundation-Specific Search', 'searchSpecificFoundation')
    .addItem('💰 Amount-Range Search', 'searchByAmountRange')
    .addItem('📍 Geographic Search', 'searchGeographicFocus')
    .addItem('👥 Demographic Search', 'searchDemographicFocus')
    .addSeparator()
    .addItem('🔍 Unadvertised Grant Finder', 'setupUnadvertisedFinder')
    .addToUi();

  // System Health Menu (Enhanced)
  ui.createMenu('🛡️ System Health')
    .addItem('📊 Run Health Check', 'runHealthCheck')
    .addItem('🧪 Test All Modules', 'testAllModules')
    .addSeparator()
    .addItem('🔧 Test Real Grant Discovery', 'testRealGrantDiscovery')
    .addItem('🧪 Test Dual-Track Analysis', 'testDualTrackAnalysisDetailed')
    .addItem('🔗 Test API Connection', 'testAPIConnection')
    .addSeparator()
    .addItem('📋 Show Available Columns', 'showAvailableColumns')
    .addItem('🔄 Refresh System', 'refreshGrantSystem')
    .addToUi();
}

/**
 * NEW FUNCTION - Test all modules including real grant discovery
 */
function testAllModules() {
  const ui = SpreadsheetApp.getUi();
  
  ui.alert('🧪 Testing All Modules',
    'Running comprehensive system tests...\n\n' +
    '• Core modules\n' +
    '• Real grant discovery\n' +
    '• Dual-track analysis\n' +
    '• API connections\n\n' +
    'This may take 3-5 minutes.',
    ui.ButtonSet.OK);
  
  console.log('🧪 COMPREHENSIVE MODULE TESTING');
  console.log('===============================');
  
  try {
    const results = {
      coreModules: false,
      realGrantDiscovery: false,
      dualTrackAnalysis: false,
      apiConnection: false
    };
    
    // Test 1: Core modules
    console.log('1. Testing core modules...');
    const moduleTest = testModuleAvailability();
    results.coreModules = moduleTest.allLoaded;
    console.log(`✅ Core modules: ${moduleTest.loadedCount}/${moduleTest.totalCount} loaded`);
    
    // Test 2: API connection
    console.log('2. Testing API connection...');
    try {
      const apiTest = APIUtils.testConnection();
      results.apiConnection = apiTest.success;
      console.log(`✅ API connection: ${apiTest.success ? 'Working' : 'Failed'}`);
    } catch (error) {
      console.error('❌ API test failed:', error);
    }
    
    // Test 3: Real grant discovery
    console.log('3. Testing real grant discovery...');
    try {
      results.realGrantDiscovery = testRealGrantDiscovery();
      console.log(`✅ Real grant discovery: ${results.realGrantDiscovery ? 'Working' : 'Failed'}`);
    } catch (error) {
      console.error('❌ Real grant discovery test failed:', error);
    }
    
    // Test 4: Dual-track analysis
    console.log('4. Testing dual-track analysis...');
    try {
      results.dualTrackAnalysis = testDualTrackAnalysisDetailed();
      console.log(`✅ Dual-track analysis: ${results.dualTrackAnalysis ? 'Working' : 'Failed'}`);
    } catch (error) {
      console.error('❌ Dual-track analysis test failed:', error);
    }
    
    // Summary
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log('\n🎯 TEST SUMMARY:');
    console.log('================');
    console.log(`Passed: ${passedTests}/${totalTests} tests`);
    console.log(`Core Modules: ${results.coreModules ? '✅' : '❌'}`);
    console.log(`API Connection: ${results.apiConnection ? '✅' : '❌'}`);
    console.log(`Real Grant Discovery: ${results.realGrantDiscovery ? '✅' : '❌'}`);
    console.log(`Dual-Track Analysis: ${results.dualTrackAnalysis ? '✅' : '❌'}`);
    
    const status = passedTests === totalTests ? 'All Systems Operational' : 
                   passedTests >= totalTests * 0.75 ? 'Most Systems Working' : 
                   'Multiple Issues Detected';
    
    ui.alert('🧪 Testing Complete',
      `System Test Results: ${status}\n\n` +
      `✅ Passed: ${passedTests}/${totalTests} tests\n\n` +
      `Core Modules: ${results.coreModules ? '✅' : '❌'}\n` +
      `API Connection: ${results.apiConnection ? '✅' : '❌'}\n` +
      `Real Grant Discovery: ${results.realGrantDiscovery ? '✅' : '❌'}\n` +
      `Dual-Track Analysis: ${results.dualTrackAnalysis ? '✅' : '❌'}\n\n` +
      'Check execution log for details.',
      ui.ButtonSet.OK);
    
  } catch (error) {
    console.error('❌ Module testing failed:', error);
    ui.alert('❌ Test Failed', `Module testing failed: ${error.message}`, ui.ButtonSet.OK);
  }
}

/**
 * NEW FUNCTION - Refresh the entire grant system
 */
function refreshGrantSystem() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert('🔄 Refresh Grant System',
    'This will refresh all system components:\n\n' +
    '• Reload all modules\n' +
    '• Update menu systems\n' +
    '• Validate configurations\n' +
    '• Test key functions\n\n' +
    'Continue with system refresh?',
    ui.ButtonSet.YES_NO);
  
  if (response !== ui.Button.YES) return;
  
  try {
    console.log('🔄 REFRESHING GRANT SYSTEM');
    console.log('==========================');
    
    // Step 1: Test module availability
    console.log('1. Testing module availability...');
    const moduleTest = testModuleAvailability();
    console.log(`Modules loaded: ${moduleTest.loadedCount}/${moduleTest.totalCount}`);
    
    // Step 2: Validate configurations
    console.log('2. Validating configurations...');
    const configValid = typeof GRANT_CONFIG !== 'undefined' && 
                       typeof DUAL_TRACK_CONFIG !== 'undefined';
    console.log(`Configuration: ${configValid ? '✅' : '❌'}`);
    
    // Step 3: Test sheet structure
    console.log('3. Checking sheet structure...');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const newGrantsSheet = ss.getSheetByName('New_Grants');
    const hasSheets = newGrantsSheet !== null;
    console.log(`Sheets: ${hasSheets ? '✅' : '❌'}`);
    
    // Step 4: Recreate menus
    console.log('4. Refreshing menus...');
    createMenus();
    console.log('✅ Menus refreshed');
    
    // Step 5: Test key functions
    console.log('5. Testing key functions...');
    const keyFunctionsWork = typeof GrantDiscovery !== 'undefined' && 
                            typeof GrantDiscovery.findRealCurrentGrants === 'function';
    console.log(`Key functions: ${keyFunctionsWork ? '✅' : '❌'}`);
    
    const overallHealth = moduleTest.allLoaded && configValid && hasSheets && keyFunctionsWork;
    
    ui.alert('✅ System Refresh Complete',
      `Grant system refresh completed!\n\n` +
      `Overall Status: ${overallHealth ? '🟢 Healthy' : '🟡 Needs Attention'}\n\n` +
      `Modules: ${moduleTest.loadedCount}/${moduleTest.totalCount}\n` +
      `Configuration: ${configValid ? '✅' : '❌'}\n` +
      `Sheets: ${hasSheets ? '✅' : '❌'}\n` +
      `Functions: ${keyFunctionsWork ? '✅' : '❌'}\n\n` +
      'System is ready for use!',
      ui.ButtonSet.OK);
    
  } catch (error) {
    console.error('❌ System refresh failed:', error);
    ui.alert('❌ Refresh Failed', `System refresh failed: ${error.message}`, ui.ButtonSet.OK);
  }
}

/**
 * ENHANCED testModuleAvailability function - includes real grant discovery
 */
function testModuleAvailability() {
  const modules = {
    'GRANT_CONFIG': typeof GRANT_CONFIG !== 'undefined',
    'CoreUtils': typeof CoreUtils !== 'undefined',
    'DateUtils': typeof DateUtils !== 'undefined',
    'APIUtils': typeof APIUtils !== 'undefined',
    'SheetManager': typeof SheetManager !== 'undefined',
    'GrantDiscovery': typeof GrantDiscovery !== 'undefined',
    'GrantDiscovery.findRealCurrentGrants': typeof GrantDiscovery !== 'undefined' && 
                                           typeof GrantDiscovery.findRealCurrentGrants === 'function',
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