/**
 * ENHANCED SYSTEM HEALTH MODULE - Module9_SystemHealth.gs
 * Extended to include real grant discovery system monitoring
 */

const SystemHealth = {
   
  runHealthCheck() {
    const ui = SpreadsheetApp.getUi();
     
    ui.alert('System Health Check',
      'Running comprehensive system diagnostics...\n\n' +
      '🔍 Checking modules\n' +
      '📊 Validating sheets\n' +
      '🔑 Testing API connection\n' +
      '📈 Analyzing data integrity\n' +
      '🎯 Testing real grant discovery',
      ui.ButtonSet.OK);
     
    try {
      const healthReport = this.generateHealthReport();
      this.displayHealthReport(healthReport);
      this.logHealthReport(healthReport);
       
    } catch (error) {
      Logger.log(`❌ Health check error: ${error.message}`);
      ui.alert('❌ Health Check Error',
        `Health check failed: ${error.message}`,
        ui.ButtonSet.OK);
    }
  },

  generateHealthReport() {
    const report = {
      timestamp: new Date(),
      overall: 'Healthy',
      modules: this.checkModules(),
      sheets: this.checkSheets(),
      apiConnection: this.checkAPIConnection(),
      dataIntegrity: this.checkDataIntegrity(),
      realGrantDiscovery: this.checkRealGrantDiscovery(), // NEW
      warnings: [],
      errors: []
    };
     
    // Determine overall health
    const components = [report.modules, report.sheets, report.apiConnection, 
                       report.dataIntegrity, report.realGrantDiscovery];
    const criticalIssues = components.filter(c => c.status === 'Critical').length;
    const warnings = components.filter(c => c.status === 'Warning').length;
    
    if (criticalIssues > 0) {
      report.overall = 'Critical Issues';
    } else if (warnings > 0) {
      report.overall = 'Minor Issues';
    }
     
    return report;
  },

  checkModules() {
    const modules = {
      'CoreUtils': this.testModule(() => CoreUtils.getSpreadsheetSafely()),
      'DateUtils': this.testModule(() => DateUtils.calculateDaysLeft('2025-12-31')),
      'APIUtils': this.testModule(() => typeof APIUtils.callOpenAI === 'function'),
      'SheetManager': this.testModule(() => typeof SheetManager.setupGrantsManagement === 'function'),
      'GrantDiscovery': this.testModule(() => typeof GrantDiscovery.autoDiscoverGrants === 'function'),
      'GrantDiscovery.findRealCurrentGrants': this.testModule(() => typeof GrantDiscovery.findRealCurrentGrants === 'function'),
      'GrantAssessment': this.testModule(() => typeof GrantAssessment.assessGrants === 'function'),
      'PitchGeneration': this.testModule(() => typeof PitchGeneration.generatePitches === 'function'),
      'SystemHealth': this.testModule(() => typeof SystemHealth.runHealthCheck === 'function'),
      'DualTrackAnalysis': this.testModule(() => typeof DualTrackAnalysis !== 'undefined')
    };
     
    const loaded = Object.values(modules).filter(status => status === 'Loaded').length;
    const total = Object.keys(modules).length;
     
    return {
      modules: modules,
      summary: `${loaded}/${total} modules loaded`,
      status: loaded === total ? 'Healthy' : loaded >= total * 0.8 ? 'Warning' : 'Critical'
    };
  },

  testModule(testFunction) {
    try {
      testFunction();
      return 'Loaded';
    } catch (error) {
      return 'Error';
    }
  },

  checkSheets() {
    const requiredSheets = Object.values(GRANT_CONFIG.SHEETS);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const existingSheets = ss.getSheets().map(sheet => sheet.getName());
     
    const sheetStatus = {};
    let missingSheets = [];
     
    requiredSheets.forEach(sheetName => {
      if (existingSheets.includes(sheetName)) {
        sheetStatus[sheetName] = this.validateSheetStructure(sheetName);
      } else {
        sheetStatus[sheetName] = 'Missing';
        missingSheets.push(sheetName);
      }
    });
     
    return {
      sheets: sheetStatus,
      missing: missingSheets,
      status: missingSheets.length === 0 ? 'Healthy' : 'Warning',
      summary: `${requiredSheets.length - missingSheets.length}/${requiredSheets.length} sheets present`
    };
  },

  validateSheetStructure(sheetName) {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
       
      if (!sheet) return 'Missing';
       
      if (sheetName === GRANT_CONFIG.SHEETS.GRANTS || sheetName === GRANT_CONFIG.SHEETS.NEW_GRANTS) {
        if (sheet.getLastColumn() < 20) {
          return 'Incomplete Headers';
        }
         
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const requiredHeaders = ['Grant_Name', 'Days_Left', 'Sponsor_Org', 'Status'];
        const missingHeaders = requiredHeaders.filter(header =>
          !headers.some(h => h && h.toString().trim() === header)
        );
         
        if (missingHeaders.length > 0) {
          return `Missing Headers: ${missingHeaders.join(', ')}`;
        }
      }
       
      return 'Valid';
       
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },

  checkAPIConnection() {
    try {
      const apiKey = getOpenAIApiKey();
       
      if (!apiKey) {
        return {
          status: 'Critical',
          message: 'OpenAI API key not configured',
          summary: 'No API Key'
        };
      }
       
      if (!APIUtils.validateApiKey(apiKey)) {
        return {
          status: 'Critical',
          message: 'API key format appears invalid',
          summary: 'Invalid Key Format'
        };
      }
       
      // Test connection with minimal request
      const testResult = APIUtils.testConnection();
       
      return {
        status: testResult.success ? 'Healthy' : 'Critical',
        message: testResult.success ? 'API connection successful' : testResult.error,
        summary: testResult.success ? 'Connected' : 'Connection Failed'
      };
       
    } catch (error) {
      return {
        status: 'Critical',
        message: error.message,
        summary: 'Error'
      };
    }
  },

  checkDataIntegrity() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const grantsSheet = ss.getSheetByName(GRANT_CONFIG.SHEETS.GRANTS);
       
      if (!grantsSheet || grantsSheet.getLastRow() <= 1) {
        return {
          status: 'Warning',
          grants: 0,
          issues: [],
          summary: 'No Data'
        };
      }
       
      const data = grantsSheet.getDataRange().getValues();
      const headers = data[0];
      const columnMap = CoreUtils.createColumnMapping(grantsSheet);
       
      const issues = [];
      let validGrants = 0;
       
      // Check data quality
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
         
        // Check for grant name
        if (!row[0] || !row[0].toString().trim()) {
          issues.push(`Row ${i + 1}: Missing grant name`);
          continue;
        }
         
        validGrants++;
         
        // Check for critical missing data
        if (columnMap['Status'] !== undefined && !row[columnMap['Status']]) {
          issues.push(`Row ${i + 1}: Missing status`);
        }
         
        if (columnMap['Days_Left'] !== undefined && !row[columnMap['Days_Left']]) {
          issues.push(`Row ${i + 1}: Missing days left calculation`);
        }
      }
       
      return {
        status: issues.length === 0 ? 'Healthy' : issues.length <= 5 ? 'Warning' : 'Critical',
        grants: validGrants,
        issues: issues.slice(0, 10), // Show first 10 issues
        summary: issues.length === 0 ? 'Clean' : `${issues.length} Issues`
      };
       
    } catch (error) {
      return {
        status: 'Critical',
        message: error.message,
        grants: 0,
        issues: [],
        summary: 'Error'
      };
    }
  },

  // NEW FUNCTION - Check real grant discovery system
  checkRealGrantDiscovery() {
    try {
      console.log('🔍 Checking real grant discovery system...');
      
      const checks = {
        findRealCurrentGrants: typeof GrantDiscovery.findRealCurrentGrants === 'function',
        findFederalGrants: typeof GrantDiscovery.findFederalGrants === 'function',
        findFoundationGrants: typeof GrantDiscovery.findFoundationGrants === 'function',
        findCorporateGrants: typeof GrantDiscovery.findCorporateGrants === 'function',
        parseRealGrantResponse: typeof GrantDiscovery.parseRealGrantResponse === 'function'
      };
      
      const workingFunctions = Object.values(checks).filter(Boolean).length;
      const totalFunctions = Object.keys(checks).length;
      
      // Quick test of response parsing
      let parsingWorks = false;
      try {
        const testData = '{"data": "{\\"test\\": \\"value\\"}"}';
        const parsed = GrantDiscovery.parseRealGrantResponse(testData, 'Test');
        parsingWorks = Array.isArray(parsed);
      } catch (parseError) {
        console.error('❌ Parsing test failed:', parseError);
      }
      
      const status = workingFunctions === totalFunctions && parsingWorks ? 'Healthy' : 
                     workingFunctions >= totalFunctions * 0.8 ? 'Warning' : 'Critical';
      
      return {
        status: status,
        functions: checks,
        parsingWorks: parsingWorks,
        summary: `${workingFunctions}/${totalFunctions} functions available`,
        message: parsingWorks ? 'Real grant discovery fully operational' : 'Response parsing needs attention'
      };
      
    } catch (error) {
      console.error('❌ Real grant discovery check failed:', error);
      return {
        status: 'Critical',
        functions: {},
        parsingWorks: false,
        summary: 'System Error',
        message: `Real grant discovery check failed: ${error.message}`
      };
    }
  },

  displayHealthReport(report) {
    const ui = SpreadsheetApp.getUi();
     
    let statusIcon;
    switch (report.overall) {
      case 'Healthy': statusIcon = '✅'; break;
      case 'Minor Issues': statusIcon = '⚠️'; break;
      case 'Critical Issues': statusIcon = '❌'; break;
      default: statusIcon = '❓';
    }
     
    const message = `${statusIcon} System Health: ${report.overall}

📊 MODULES: ${report.modules.status} (${report.modules.summary})
${this.formatModuleStatus(report.modules.modules)}

📋 SHEETS: ${report.sheets.status} (${report.sheets.summary})
${report.sheets.missing.length > 0 ? 
  '⚠️ Missing: ' + report.sheets.missing.join(', ') : '✅ All sheets present'}

🔑 API CONNECTION: ${report.apiConnection.status}
${report.apiConnection.message}

📈 DATA INTEGRITY: ${report.dataIntegrity.status}
${report.dataIntegrity.grants} grants | ${report.dataIntegrity.issues.length} issues

🎯 REAL GRANT DISCOVERY: ${report.realGrantDiscovery.status}
${report.realGrantDiscovery.summary}
${report.realGrantDiscovery.message}

📅 Report Time: ${report.timestamp.toLocaleString()}`;

    ui.alert('🛡️ System Health Report', message, ui.ButtonSet.OK);
  },

  formatModuleStatus(modules) {
    return Object.entries(modules)
      .map(([name, status]) => `${status === 'Loaded' ? '✅' : '❌'} ${name}`)
      .join('\n');
  },

  logHealthReport(report) {
    Logger.log('🛡️ SYSTEM HEALTH REPORT');
    Logger.log('========================');
    Logger.log(`Overall: ${report.overall}`);
    Logger.log(`Timestamp: ${report.timestamp}`);
    Logger.log('');
    
    Logger.log('📊 MODULES:');
    Object.entries(report.modules.modules).forEach(([name, status]) => {
      Logger.log(`  ${status === 'Loaded' ? '✅' : '❌'} ${name}: ${status}`);
    });
    Logger.log('');
    
    Logger.log('📋 SHEETS:');
    Object.entries(report.sheets.sheets).forEach(([name, status]) => {
      Logger.log(`  ${status === 'Valid' ? '✅' : '❌'} ${name}: ${status}`);
    });
    Logger.log('');
    
    Logger.log('🔑 API CONNECTION:');
    Logger.log(`  Status: ${report.apiConnection.status}`);
    Logger.log(`  Message: ${report.apiConnection.message}`);
    Logger.log('');
    
    Logger.log('📈 DATA INTEGRITY:');
    Logger.log(`  Status: ${report.dataIntegrity.status}`);
    Logger.log(`  Grants: ${report.dataIntegrity.grants}`);
    Logger.log(`  Issues: ${report.dataIntegrity.issues.length}`);
    if (report.dataIntegrity.issues.length > 0) {
      report.dataIntegrity.issues.forEach(issue => {
        Logger.log(`    - ${issue}`);
      });
    }
    Logger.log('');
    
    Logger.log('🎯 REAL GRANT DISCOVERY:');
    Logger.log(`  Status: ${report.realGrantDiscovery.status}`);
    Logger.log(`  Summary: ${report.realGrantDiscovery.summary}`);
    Logger.log(`  Parsing Works: ${report.realGrantDiscovery.parsingWorks}`);
    Object.entries(report.realGrantDiscovery.functions).forEach(([name, available]) => {
      Logger.log(`  ${available ? '✅' : '❌'} ${name}`);
    });
    
    Logger.log('========================');
  },

  // NEW FUNCTION - Test real grant discovery specifically
  testRealGrantDiscovery() {
    const ui = SpreadsheetApp.getUi();
    
    ui.alert('🧪 Testing Real Grant Discovery',
      'Testing the real grant discovery system...\n\n' +
      '• API response parsing\n' +
      '• Federal grant search\n' +
      '• Foundation grant search\n' +
      '• Corporate grant search\n\n' +
      'This may take 2-3 minutes.',
      ui.ButtonSet.OK);
    
    try {
      console.log('🧪 TESTING REAL GRANT DISCOVERY SYSTEM');
      console.log('======================================');
      
      const results = {
        apiParsing: false,
        federalSearch: false,
        foundationSearch: false,
        corporateSearch: false
      };
      
      // Test 1: API Response Parsing
      console.log('1. Testing API response parsing...');
      try {
        const testData = '{"data": "[{\\"grantName\\": \\"Test Grant\\", \\"sponsorOrg\\": \\"Test Org\\"}]"}';
        const parsed = GrantDiscovery.parseRealGrantResponse(testData, 'Test');
        results.apiParsing = Array.isArray(parsed);
        console.log(`✅ API parsing: ${results.apiParsing ? 'Working' : 'Failed'}`);
      } catch (error) {
        console.error('❌ API parsing test failed:', error);
      }
      
      // Test 2: Federal Grant Search
      console.log('2. Testing federal grant search...');
      try {
        const federalGrants = GrantDiscovery.findFederalGrants(['test grant']);
        results.federalSearch = Array.isArray(federalGrants);
        console.log(`✅ Federal search: ${results.federalSearch ? 'Working' : 'Failed'} (${federalGrants.length} grants)`);
      } catch (error) {
        console.error('❌ Federal search test failed:', error);
      }
      
      // Test 3: Foundation Grant Search
      console.log('3. Testing foundation grant search...');
      try {
        const foundationGrants = GrantDiscovery.findFoundationGrants(['test grant']);
        results.foundationSearch = Array.isArray(foundationGrants);
        console.log(`✅ Foundation search: ${results.foundationSearch ? 'Working' : 'Failed'} (${foundationGrants.length} grants)`);
      } catch (error) {
        console.error('❌ Foundation search test failed:', error);
      }
      
      // Test 4: Corporate Grant Search
      console.log('4. Testing corporate grant search...');
      try {
        const corporateGrants = GrantDiscovery.findCorporateGrants(['test grant']);
        results.corporateSearch = Array.isArray(corporateGrants);
        console.log(`✅ Corporate search: ${results.corporateSearch ? 'Working' : 'Failed'} (${corporateGrants.length} grants)`);
      } catch (error) {
        console.error('❌ Corporate search test failed:', error);
      }
      
      // Summary
      const passedTests = Object.values(results).filter(Boolean).length;
      const totalTests = Object.keys(results).length;
      
      console.log('\n🎯 REAL GRANT DISCOVERY TEST SUMMARY:');
      console.log('====================================');
      console.log(`Passed: ${passedTests}/${totalTests} tests`);
      console.log(`API Parsing: ${results.apiParsing ? '✅' : '❌'}`);
      console.log(`Federal Search: ${results.federalSearch ? '✅' : '❌'}`);
      console.log(`Foundation Search: ${results.foundationSearch ? '✅' : '❌'}`);
      console.log(`Corporate Search: ${results.corporateSearch ? '✅' : '❌'}`);
      
      const status = passedTests === totalTests ? 'Fully Operational' : 
                     passedTests >= totalTests * 0.75 ? 'Mostly Working' : 
                     'Needs Attention';
      
      ui.alert('🧪 Real Grant Discovery Test',
        `Test Results: ${status}\n\n` +
        `✅ Passed: ${passedTests}/${totalTests} tests\n\n` +
        `API Parsing: ${results.apiParsing ? '✅' : '❌'}\n` +
        `Federal Search: ${results.federalSearch ? '✅' : '❌'}\n` +
        `Foundation Search: ${results.foundationSearch ? '✅' : '❌'}\n` +
        `Corporate Search: ${results.corporateSearch ? '✅' : '❌'}\n\n` +
        'Check execution log for details.',
        ui.ButtonSet.OK);
      
      return passedTests === totalTests;
      
    } catch (error) {
      console.error('❌ Real grant discovery testing failed:', error);
      ui.alert('❌ Test Failed', `Real grant discovery test failed: ${error.message}`, ui.ButtonSet.OK);
      return false;
    }
  },

  // NEW FUNCTION - Quick system status check
  getQuickStatus() {
    try {
      const moduleTest = testModuleAvailability();
      const hasAPI = typeof getOpenAIApiKey === 'function' && getOpenAIApiKey();
      const hasSheets = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('New_Grants') !== null;
      const hasRealDiscovery = typeof GrantDiscovery !== 'undefined' && 
                              typeof GrantDiscovery.findRealCurrentGrants === 'function';
      
      return {
        modules: moduleTest.allLoaded,
        api: hasAPI,
        sheets: hasSheets,
        realDiscovery: hasRealDiscovery,
        overall: moduleTest.allLoaded && hasAPI && hasSheets && hasRealDiscovery
      };
    } catch (error) {
      return {
        modules: false,
        api: false,
        sheets: false,
        realDiscovery: false,
        overall: false,
        error: error.message
      };
    }
  }
};

// ====================
// ENHANCED GLOBAL FUNCTIONS
// ====================

/**
 * Enhanced health check function
 */
function runHealthCheck() {
  SystemHealth.runHealthCheck();
}

/**
 * NEW FUNCTION - Quick status for other modules to use
 */
function getSystemStatus() {
  return SystemHealth.getQuickStatus();
}

/**
 * NEW FUNCTION - Test real grant discovery from menu
 */
function testRealGrantDiscoverySystem() {
  return SystemHealth.testRealGrantDiscovery();
}

/**
 * NEW FUNCTION - Show system summary in console
 */
function showSystemSummary() {
  console.log('📊 ELEVATED MOVEMENTS GRANT SYSTEM SUMMARY');
  console.log('==========================================');
  
  try {
    const status = SystemHealth.getQuickStatus();
    
    console.log(`Overall Status: ${status.overall ? '🟢 Operational' : '🔴 Issues Detected'}`);
    console.log('');
    console.log('Component Status:');
    console.log(`  Modules: ${status.modules ? '✅' : '❌'}`);
    console.log(`  API Connection: ${status.api ? '✅' : '❌'}`);
    console.log(`  Sheets: ${status.sheets ? '✅' : '❌'}`);
    console.log(`  Real Grant Discovery: ${status.realDiscovery ? '✅' : '❌'}`);
    
    if (status.error) {
      console.log(`  Error: ${status.error}`);
    }
    
    console.log('');
    console.log('Available Features:');
    console.log('  • Traditional grant discovery via AI');
    console.log('  • Real current grant finding (federal, foundation, corporate)');
    console.log('  • Dual-track analysis (LLC vs Foundation)');
    console.log('  • Advanced search strategies');
    console.log('  • Grant research and assessment');
    console.log('  • Pitch generation');
    console.log('  • System health monitoring');
    
    if (status.overall) {
      console.log('');
      console.log('🎯 READY FOR USE!');
      console.log('Next steps: Run "Find Real Current Grants" to discover opportunities');
    } else {
      console.log('');
      console.log('⚠️ SETUP NEEDED');
      console.log('Run "System Health Check" for detailed diagnostics');
    }
    
  } catch (error) {
    console.error('❌ System summary failed:', error);
  }
}