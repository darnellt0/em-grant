// Module5_SheetManager.gs
/** ============================================
 *  Enhanced Sheet Manager with Dual-Track Integration
 *  - Creates/validates all required tabs
 *  - Headers, formatting, dashboard, monitoring
 *  - Merge pipeline from New_Grants → Grants
 *  - INCLUDES dual-track columns (AL:BE) in initial setup
 *  - Days_Left in column B for Module6 compatibility
 *  DEPENDS ON:
 *   - GRANT_CONFIG (Module1)
 *   - CoreUtils, DateUtils (Modules 2 & 3)
 *  ============================================ */

const SheetManager = {
  setupGrantsManagement() {
    const ui = SpreadsheetApp.getUi();
    
    // Enhanced setup dialog
    const response = ui.alert(
      '🚀 Enhanced Grant Management Setup',
      'Setting up your complete grant management system including:\n\n' +
      '📊 Core tracking sheets (New_Grants, Main_Grants)\n' +
      '🤖 AI-powered discovery and assessment\n' +
      '🔍 Unadvertised grants finder\n' +
      '🎯 Dual-track analysis (LLC + Foundation)\n' +
      '📈 Advanced scoring algorithms\n' +
      '🛡️ System health monitoring\n\n' +
      'This includes ALL columns (A-BE) with dual-track capabilities.\n\n' +
      'Continue with complete setup?',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      ui.alert('Setup Cancelled', 'Grant management setup was cancelled by user.');
      return;
    }

    try {
      console.log('🚀 ENHANCED GRANT MANAGEMENT SETUP');
      console.log('==================================');
      
      const ss = CoreUtils.getSpreadsheetSafely();
      const sheets = this.createAllSheets(ss);

      // Enhanced setup with dual-track columns
      this.setupSheetHeadersComplete(sheets);
      this.applyAllFormatting(sheets);
      this.setupDashboard(sheets.dashboard);
      this.setupDataValidationSafe(sheets);

      ui.alert(
        '🎉 Enhanced Setup Complete!',
        'Your complete grant management system is ready!\n\n' +
        '✅ Core sheets: New_Grants, Main_Grants\n' +
        '✅ Dual-track columns: AL through BE\n' +
        '✅ Days_Left in column B for deadline tracking\n' +
        '✅ System monitoring: Health tracking\n' +
        '✅ Data validation: Dropdown menus\n' +
        '✅ Enhanced formatting: Color coding\n\n' +
        '🎯 Next steps:\n' +
        '1. Add your OpenAI API key (AI Tools menu)\n' +
        '2. Start discovering grants (Grant Discovery)\n' +
        '3. Use dual-track analysis (Advanced Analytics)\n\n' +
        'Your system includes ALL features from day one!',
        ui.ButtonSet.OK
      );
      
      CoreUtils.logSystemEvent('Enhanced System Setup', 'Success', 'Complete dual-track system setup finished');
    } catch (err) {
      Logger.log(`❌ Setup error: ${err.message}`);
      ui.alert('❌ Setup Error', `Setup failed: ${err.message}`, ui.ButtonSet.OK);
    }
  },

  createAllSheets(spreadsheet) {
    const sheets = {};
    Object.entries(GRANT_CONFIG.SHEETS).forEach(([key, name]) => {
      sheets[key.toLowerCase()] = this.createOrGetSheet(spreadsheet, name);
    });
    
    // Add additional sheets for enhanced functionality
    const additionalSheets = {
      'unadvertised_leads': 'Unadvertised_Leads',
      'pastebin_990': '990_Pastebin'
    };
    
    Object.entries(additionalSheets).forEach(([key, name]) => {
      sheets[key] = this.createOrGetSheet(spreadsheet, name);
    });
    
    Logger.log(`✅ Created/verified ${Object.keys(sheets).length} sheets`);
    return sheets;
  },

  createOrGetSheet(ss, name) {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      Logger.log(`Creating new sheet: ${name}`);
      sh = ss.insertSheet(name);
    } else {
      Logger.log(`Sheet already exists: ${name}`);
    }
    return sh;
  },

  // Enhanced setup with complete headers including dual-track
  setupSheetHeadersComplete(sheets) {
    this.setupGrantsSheetHeadersComplete(sheets.grants);
    this.setupNewGrantsSheetHeadersComplete(sheets.new_grants);
    this.setupDashboardHeaders(sheets.dashboard);
    this.setupPromptTemplatesHeaders(sheets.prompt_templates);
    this.setupMonitoringHeaders(sheets.system_monitoring);
    this.setupUnadvertisedFinderSheets(sheets);
  },

  // === GRANTS master sheet headers with COMPLETE dual-track columns ===
  setupGrantsSheetHeadersComplete(sheet) {
    // Complete header set including dual-track columns (A-BE)
    const completeHeaders = this.getCompleteHeaderSet();

    if (sheet.getLastRow() === 0 || !sheet.getRange(1,1).getValue()) {
      // Clear any existing content
      sheet.clear();
      
      // Add complete headers
      sheet.getRange(1, 1, 1, completeHeaders.length).setValues([completeHeaders]);
      sheet.getRange(1, 1, 1, completeHeaders.length)
        .setFontWeight('bold')
        .setBackground('#36013f')
        .setFontColor('white');
      sheet.setFrozenRows(1);

      // Set column widths for key columns
      sheet.setColumnWidth(1, 220);  // Grant_Name
      sheet.setColumnWidth(2, 80);   // Days_Left
      sheet.setColumnWidth(3, 180);  // Sponsor_Org
      sheet.setColumnWidth(4, 140);  // Contact_Person
      sheet.setColumnWidth(6, 100);  // Amount
      sheet.setColumnWidth(14, 280); // Notes
      
      Logger.log(`✅ Grants sheet headers configured with ${completeHeaders.length} columns (includes AL:BE dual-track with Days_Left in B)`);
    }
  },

  // === NEW_GRANTS inherits complete structure from GRANTS ===
  setupNewGrantsSheetHeadersComplete(sheet) {
    // Use same complete structure
    const completeHeaders = this.getCompleteHeaderSet();
    
    sheet.clear();
    sheet.getRange(1, 1, 1, completeHeaders.length).setValues([completeHeaders]);
    
    // Apply header formatting
    sheet.getRange(1, 1, 1, completeHeaders.length)
      .setFontWeight('bold')
      .setBackground('#176161')
      .setFontColor('white');
    
    sheet.setFrozenRows(1);
    
    // Set column widths for key columns
    sheet.setColumnWidth(1, 220);  // Grant_Name
    sheet.setColumnWidth(2, 80);   // Days_Left
    sheet.setColumnWidth(3, 180);  // Sponsor_Org
    sheet.setColumnWidth(4, 140);  // Contact_Person
    sheet.setColumnWidth(6, 100);  // Amount
    
    Logger.log('✅ New_Grants sheet configured with complete dual-track structure including Days_Left in B');
  },

  // Get complete header set (A-BE) - centralized definition with Days_Left in column B
  getCompleteHeaderSet() {
    return [
      // Core Grant Information with Days_Left in column B (A-S)
      'Grant_Name',           // A
      'Days_Left',            // B - Essential for deadline tracking
      'Sponsor_Org',          // C
      'Contact_Person',       // D
      'Focus_Area',           // E
      'Amount',               // F
      'Deadline (Est.)',      // G
      'Status',               // H
      'Draft_Pitch',          // I
      'reporting requirements', // J
      'renewable',            // K
      'Eligibility Summary',  // L
      'Application Link',     // M
      'Notes',                // N
      'Discovery_Source',     // O
      'Source_Reliability_Score', // P
      'Geographic_Scope',     // Q
      'Funder_Type',          // R
      'Last_Discovery_Date',  // S
      
      // Scoring & Assessment (T-AK) 
      'Priority_Score',           // T
      'Business_Match_Pct',       // U
      'Prep_Time_Hours',          // V
      'Complexity_Rating',        // W
      'Success_Probability',      // X
      'Competition_Level',        // Y
      'Community_Impact_Score',   // Z
      'WOC_Focus_Rating',         // AA
      'Leadership_Dev_Alignment', // AB
      'Research_Complete',        // AC
      'Application_Started',      // AD
      'Documents_Gathered',       // AE
      'Application_Submitted',    // AF
      'Follow_Up_Sent',          // AG
      'Response_Received',       // AH
      'Award_Received',          // AI
      'Date_Added',              // AJ
      'Last_Updated',            // AK
      
      // Dual-Track Enhanced Analysis (AL-BE)
      'Eligible_For',                    // AL
      'Structure_Recommendation',        // AM
      'Current_Priority',               // AN
      'Foundation_Timeline',            // AO
      'LLC_Funding_Type',               // AP
      'Corporate_CSR_Alignment',        // AQ
      'Silicon_Valley_Advantage',       // AR
      'Revenue_Model_Fit',              // AS
      'Partnership_Potential',          // AT
      'Dual_Opportunity',               // AU
      'Strategic_Timing',               // AV
      'Market_Positioning',             // AW
      'Scalability_Potential_DT',       // AX
      'LLC_Priority_Score',             // AY
      'Foundation_Priority_Score',      // AZ
      'Overall_Strategic_Value',        // BA
      'Competitive_Advantage',          // BB
      'Risk_Assessment_DT',             // BC
      'ROI_Potential',                  // BD
      'Strategic_Alignment'             // BE
    ];
  },

  // === DASHBOARD ===
  setupDashboardHeaders(sheet) {
    sheet.clear();
    sheet.getRange(1, 1).setValue('📊 Elevated Movements Enhanced Grant Dashboard');
    sheet.getRange(1, 1).setFontSize(18).setFontWeight('bold');

    const G = GRANT_CONFIG.SHEETS.GRANTS;

    const enhancedMetrics = [
      ['Total Grants Tracked:', `=COUNTA(${G}!A:A)-1`],
      ['Active Grants:',
        '=SUM(' +
          'COUNTIF(' + G + '!H:H,"Under Research"),' +
          'COUNTIF(' + G + '!H:H,"Qualified Lead"),' +
          'COUNTIF(' + G + '!H:H,"Application Draft"))'
      ],
      ['Due This Week:',
        '=IFERROR(COUNTIF(FILTER(' + G + '!B:B,ISNUMBER(' + G + '!B:B)),"<=7"),0)'
      ],
      ['Success Rate:',
        '=IF((COUNTIF(' + G + '!H:H,"Awarded")+COUNTIF(' + G + '!H:H,"Rejected"))>0,' +
          'ROUND(COUNTIF(' + G + '!H:H,"Awarded")/' +
          '(COUNTIF(' + G + '!H:H,"Awarded")+COUNTIF(' + G + '!H:H,"Rejected"))*100,0)&"%","TBD")'
      ],
      ['', ''], // Spacer
      ['🎯 DUAL-TRACK METRICS:', ''],
      ['LLC Opportunities:', `=COUNTIF(${G}!AL:AL,"LLC Only")+COUNTIF(${G}!AL:AL,"Both")`],
      ['Foundation Pipeline:', `=COUNTIF(${G}!AL:AL,"501c3 Only")+COUNTIF(${G}!AL:AL,"Both")`],
      ['High Strategic Value:', `=COUNTIF(${G}!BA:BA,">=80")`],
      ['Average LLC Score:', `=IFERROR(AVERAGE(FILTER(${G}!AY:AY,ISNUMBER(${G}!AY:AY))),0)`],
      ['Average Foundation Score:', `=IFERROR(AVERAGE(FILTER(${G}!AZ:AZ,ISNUMBER(${G}!AZ:AZ))),0)`]
    ];

    sheet.getRange(3, 1, enhancedMetrics.length, 2).setValues(enhancedMetrics);
    
    // Format metrics section
    sheet.getRange(8, 1).setFontWeight('bold').setBackground('#E8F4FD');
    
    Logger.log('✅ Enhanced dashboard headers configured with dual-track metrics (Days_Left in column B references)');
  },

  setupPromptTemplatesHeaders(sheet) {
    const enhancedTemplate = `Generate a compelling grant application pitch for Elevated Movements:

Grant Details:
- Name: {{Grant_Name}}
- Sponsor: {{Sponsor_Org}}
- Amount: {{Amount}}
- Focus: {{Focus_Area}}
- Deadline: {{Deadline (Est.)}}
- Days Left: {{Days_Left}}
- Eligibility: {{Eligible_For}}
- Strategic Priority: {{Current_Priority}}

Organization: Elevated Movements
Founder: Shria Tomlinson (shria@elevatedmovements.com)
Mission: Women of color leadership development and community impact
Structure: {{Structure_Recommendation}}

Create a professional pitch that:
1. Shows alignment with grant focus
2. Highlights our WOC leadership expertise
3. Demonstrates community impact potential
4. Addresses dual-track strategy (LLC/Foundation)
5. Emphasizes strategic positioning
6. Is compelling but concise (2-3 paragraphs)

Write from Shria Tomlinson's perspective as founder.`;

    sheet.getRange('A1').setValue(enhancedTemplate);
    sheet.getRange('A1').setWrap(true);
    sheet.setColumnWidth(1, 900);
    Logger.log('✅ Enhanced PromptTemplates configured with dual-track variables including Days_Left');
  },

  setupMonitoringHeaders(sheet) {
    if (sheet.getLastRow() === 0) {
      const headers = ['Timestamp', 'Event', 'Status', 'Details', 'System_Component'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E6F3FF');
      sheet.setColumnWidth(1, 160);
      sheet.setColumnWidth(2, 220);
      sheet.setColumnWidth(3, 120);
      sheet.setColumnWidth(4, 420);
      sheet.setColumnWidth(5, 160);
    }
  },

  // Setup unadvertised finder sheets
  setupUnadvertisedFinderSheets(sheets) {
    try {
      if (sheets.unadvertised_leads) {
        this.setupUnadvertisedLeadsSheet(sheets.unadvertised_leads);
      }
      if (sheets.pastebin_990) {
        this.setup990PastebinSheet(sheets.pastebin_990);
      }
      Logger.log('✅ Unadvertised finder sheets configured');
    } catch (error) {
      Logger.log('⚠️ Unadvertised finder setup skipped:', error.message);
    }
  },

  setupUnadvertisedLeadsSheet(sheet) {
    if (sheet.getLastRow() === 0) {
      const headers = [
        'Funder_Name', 'Funder_Type', 'Geographic_Scope', 'Explicit_Women_Signal',
        'Average_Grant_USD', 'Website', 'Accepts_Unsolicited', 'Primary_Program_Areas',
        'Contact_Name', 'Contact_Email', 'Contact_Role',
        'Source', 'Source_Notes',
        'Warmth', 'Relationship_Notes',
        'Next_Check_In', 'Date_Added', 'Last_Updated'
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#2f4858')
        .setFontColor('white');
      sheet.setFrozenRows(1);

      // Set column widths
      const widths = [240, 140, 140, 120, 140, 220, 150, 220, 180, 200, 160, 140, 240, 120, 280, 130, 130, 130];
      widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
    }
  },

  setup990PastebinSheet(sheet) {
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1).setValue('📎 Paste 990 / annual report / funder list text in A2 downward. Then use menu: Unadvertised Finder → Import.');
      sheet.getRange(1, 1).setWrap(true).setFontWeight('bold');
      sheet.setColumnWidth(1, 800);
    }
  },

  // Setup data validation safely (improved version)
  setupDataValidationSafe(sheets) {
    try {
      const mainSheet = sheets.grants;
      const newSheet = sheets.new_grants;
      
      [mainSheet, newSheet].forEach(sheet => {
        if (sheet && sheet.getLastColumn() > 0) {
          this.addDropdownValidationSafe(sheet);
        }
      });
      
      Logger.log('✅ Data validation configured safely for all sheets');
    } catch (error) {
      Logger.log('⚠️ Data validation setup skipped to avoid conflicts:', error.message);
    }
  },

  addDropdownValidationSafe(sheet) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const lastRow = Math.max(sheet.getLastRow(), 20);
    
    // Safe validation rules with fewer options to avoid conflicts
    const validationRules = {
      'Status': ['New', 'Under Research', 'Qualified Lead', 'Application Submitted', 'Awarded', 'Rejected'],
      'Eligible_For': ['LLC Only', '501c3 Only', 'Both'],
      'Structure_Recommendation': ['Current LLC', 'Future Foundation', 'Partnership Model'],
      'Current_Priority': ['Immediate (LLC)', 'Future (Foundation)', 'Both Tracks'],
      'Foundation_Timeline': ['Year 1', 'Year 2', 'Year 3+', 'Dependent on LLC Success'],
      'Dual_Opportunity': ['Yes', 'No'],
      'Strategic_Timing': ['Immediate', '6 Months', '1 Year', '2+ Years']
    };
    
    // Apply validation rules with error handling
    Object.entries(validationRules).forEach(([columnName, values]) => {
      const colIndex = headers.indexOf(columnName);
      
      if (colIndex !== -1) {
        try {
          const colNumber = colIndex + 1;
          const range = sheet.getRange(2, colNumber, lastRow - 1, 1);
          
          const validation = SpreadsheetApp.newDataValidation()
            .requireValueInList(values)
            .setAllowInvalid(true) // Allow invalid to prevent blocking
            .setHelpText(`Select one: ${values.join(', ')}`)
            .build();
          
          range.setDataValidation(validation);
          Logger.log(`  ✅ Added validation for ${columnName}`);
        } catch (error) {
          Logger.log(`  ⚠️ Skipped validation for ${columnName}: ${error.message}`);
        }
      }
    });
  },

  // Enhanced dashboard with dual-track insights
  setupDashboard(dashboardSheet) {
    if (!dashboardSheet) return;
    
    // Add action items
    dashboardSheet.getRange(15, 1).setValue('🎯 Next Actions:').setFontWeight('bold');
    const actions = [
      '• Review LLC quick wins (Priority Score > 80)',
      '• Check Foundation pipeline opportunities',
      '• Follow up on submitted applications',
      '• Update dual-track scores weekly',
      '• Research new dual-track opportunities'
    ];
    actions.forEach((a, i) => dashboardSheet.getRange(16 + i, 1).setValue(a));
    
    // Add dual-track strategy section
    dashboardSheet.getRange(22, 1).setValue('🚀 Dual-Track Strategy:').setFontWeight('bold');
    const strategy = [
      '• Focus on LLC opportunities for immediate revenue',
      '• Build Foundation pipeline for Year 2 launch',
      '• Identify grants that work for both structures',
      '• Track corporate partnership potential'
    ];
    strategy.forEach((s, i) => dashboardSheet.getRange(23 + i, 1).setValue(s));
    
    Logger.log('✅ Enhanced dashboard setup complete with dual-track guidance');
  },

  // === ENHANCED FORMATTING ===
  applyAllFormatting(sheets) {
    this.applyGrantsSheetFormattingEnhanced(sheets.grants);
    this.applyGrantsSheetFormattingEnhanced(sheets.new_grants);
    Logger.log('✅ Enhanced conditional formatting applied');
  },

  applyGrantsSheetFormattingEnhanced(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    sheet.clearConditionalFormatRules();
    const rules = [];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Create column mapping
    const columnMap = {};
    headers.forEach((header, index) => {
      if (header) columnMap[header] = index + 1;
    });

    // Days_Left warning (< 7 days)
    if (columnMap['Days_Left']) {
      const rg = sheet.getRange(2, columnMap['Days_Left'], lastRow - 1, 1);
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .setRanges([rg])
          .whenNumberLessThan(7)
          .setBackground('#ffcccc')
          .setFontColor('#cc0000')
          .build()
      );
    }

    // Priority_Score highlight (>= 80)
    if (columnMap['Priority_Score']) {
      const rg = sheet.getRange(2, columnMap['Priority_Score'], lastRow - 1, 1);
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .setRanges([rg])
          .whenNumberGreaterThanOrEqualTo(80)
          .setBackground('#d4edda')
          .setFontColor('#155724')
          .build()
      );
    }

    // LLC Priority Score highlighting
    if (columnMap['LLC_Priority_Score']) {
      const rg = sheet.getRange(2, columnMap['LLC_Priority_Score'], lastRow - 1, 1);
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .setRanges([rg])
          .whenNumberGreaterThanOrEqualTo(80)
          .setBackground('#c8e6c9')
          .setFontColor('#2e7d32')
          .build()
      );
    }

    // Foundation Priority Score highlighting
    if (columnMap['Foundation_Priority_Score']) {
      const rg = sheet.getRange(2, columnMap['Foundation_Priority_Score'], lastRow - 1, 1);
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .setRanges([rg])
          .whenNumberGreaterThanOrEqualTo(80)
          .setBackground('#e1f5fe')
          .setFontColor('#0277bd')
          .build()
      );
    }

    // Overall Strategic Value highlighting
    if (columnMap['Overall_Strategic_Value']) {
      const rg = sheet.getRange(2, columnMap['Overall_Strategic_Value'], lastRow - 1, 1);
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .setRanges([rg])
          .whenNumberGreaterThanOrEqualTo(90)
          .setBackground('#fff3e0')
          .setFontColor('#ef6c00')
          .build()
      );
    }

    // Dual Opportunity highlighting
    if (columnMap['Dual_Opportunity']) {
      const rg = sheet.getRange(2, columnMap['Dual_Opportunity'], lastRow - 1, 1);
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .setRanges([rg])
          .whenTextEqualTo('Yes')
          .setBackground('#f3e5f5')
          .setFontColor('#7b1fa2')
          .build()
      );
    }

    sheet.setConditionalFormatRules(rules);
    Logger.log('✅ Enhanced grants conditional formatting applied with dual-track highlighting');
  },

  // === DATA UPDATES ===
  updateDaysLeft() {
    try {
      const sheet = CoreUtils.getSheetSafely(GRANT_CONFIG.SHEETS.GRANTS);
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return 0;

      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const deadlineCol = headers.indexOf('Deadline (Est.)');
      const daysLeftCol = headers.indexOf('Days_Left');
      const now = new Date();
      let count = 0;

      for (let r = 1; r < data.length; r++) {
        if (deadlineCol !== -1 && data[r][deadlineCol] && daysLeftCol !== -1) {
          const deadline = new Date(data[r][deadlineCol]);
          const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
          sheet.getRange(r + 1, daysLeftCol + 1).setValue(daysLeft);
          count++;
        }
      }
      
      Logger.log(`✅ Updated Days_Left for ${count} rows`);
      return count;
    } catch (e) {
      Logger.log(`❌ updateDaysLeft error: ${e.message}`);
      throw e;
    }
  },

  // === ENHANCED MERGE PIPELINE ===
  mergeNewGrants() {
    const ui = SpreadsheetApp.getUi();
    try {
      const ss = CoreUtils.getSpreadsheetSafely();
      const grants = ss.getSheetByName(GRANT_CONFIG.SHEETS.GRANTS);
      const staging = ss.getSheetByName(GRANT_CONFIG.SHEETS.NEW_GRANTS);
      
      if (!grants || !staging) {
        ui.alert('❌ Error', 'Required sheets missing. Run Setup System first.', ui.ButtonSet.OK);
        return;
      }
      
      if (staging.getLastRow() <= 1) {
        ui.alert('No Data', 'No rows found in New_Grants.', ui.ButtonSet.OK);
        return;
      }

      const mainHdr = grants.getRange(1, 1, 1, grants.getLastColumn()).getValues()[0];
      const newHdr = staging.getRange(1, 1, 1, staging.getLastColumn()).getValues()[0];
      const newData = staging.getDataRange().getValues();

      // Get existing grant names
      const existing = grants.getLastRow() > 1
        ? grants.getRange(2, 1, grants.getLastRow() - 1, 1).getValues()
            .flat().filter(Boolean).map(s => s.toString().trim().toLowerCase())
        : [];

      const toAdd = [];
      for (let i = 1; i < newData.length; i++) {
        const name = newData[i][0];
        if (!name) continue;
        const norm = name.toString().trim().toLowerCase();
        if (!existing.includes(norm)) toAdd.push(newData[i]);
      }
      
      if (toAdd.length === 0) {
        ui.alert('No New Grants', 'All items already exist in main sheet.', ui.ButtonSet.OK);
        return;
      }

      const mapping = this.createColumnMappingBetweenSheets(newHdr, mainHdr);
      const start = grants.getLastRow() + 1;
      const now = new Date();

      toAdd.forEach((row, idx) => {
        const out = new Array(mainHdr.length).fill('');
        Object.entries(mapping).forEach(([srcIdx, tgtIdx]) => {
          const v = row[+srcIdx];
          if (v !== undefined && v !== null && v !== '') out[tgtIdx] = v;
        });
        this.setDefaultColumnValuesEnhanced(out, mainHdr, now);
        grants.getRange(start + idx, 1, 1, out.length).setValues([out]);
      });

      // Reset staging - preserve header row
      const headerRow = staging.getRange(1, 1, 1, newHdr.length).getValues();
      staging.clear();
      staging.getRange(1, 1, 1, newHdr.length).setValues(headerRow);
      
      // Restore header formatting
      staging.getRange(1, 1, 1, newHdr.length)
        .setFontWeight('bold')
        .setBackground('#176161')
        .setFontColor('white');

      this.applyGrantsSheetFormattingEnhanced(grants);
      ui.alert('✅ Merge Complete', `Merged ${toAdd.length} grants into main sheet with dual-track capabilities.`, ui.ButtonSet.OK);
      CoreUtils.logSystemEvent('Enhanced Grant Merge', 'Success', `Merged ${toAdd.length} grants with dual-track data`);
    } catch (e) {
      Logger.log(`❌ mergeNewGrants error: ${e.message}`);
      ui.alert('❌ Merge Error', e.message, ui.ButtonSet.OK);
    }
  },

  createColumnMappingBetweenSheets(sourceHeaders, targetHeaders) {
    const mapping = {};
    sourceHeaders.forEach((src, i) => {
      if (!src) return;
      const s = src.toString().trim();
      let tgt = targetHeaders.findIndex(h => h && h.toString().trim() === s);
      if (tgt !== -1) mapping[i] = tgt;
    });
    return mapping;
  },

  setDefaultColumnValuesEnhanced(rowData, headers, now) {
    headers.forEach((h, i) => {
      if (!h) return;
      const key = h.toString().toLowerCase().trim();

      // Standard defaults
      if (key === 'status' && !rowData[i]) rowData[i] = 'New';
      if (key === 'date_added' && !rowData[i]) rowData[i] = now;
      if (key === 'last_updated') rowData[i] = now;

      // Enhanced dual-track defaults
      if (key === 'eligible_for' && !rowData[i]) rowData[i] = 'Both';
      if (key === 'structure_recommendation' && !rowData[i]) rowData[i] = 'Current LLC';
      if (key === 'current_priority' && !rowData[i]) rowData[i] = 'Immediate (LLC)';
      if (key === 'dual_opportunity' && !rowData[i]) rowData[i] = 'Yes';
      if (key === 'strategic_timing' && !rowData[i]) rowData[i] = 'Immediate';

      // Calculate Days_Left if we have a deadline
      if (key === 'days_left' && !rowData[i]) {
        const dlIdx = headers.findIndex(x => x && x.toString().toLowerCase().includes('deadline'));
        if (dlIdx !== -1 && rowData[dlIdx]) {
          try {
            const deadline = new Date(rowData[dlIdx]);
            const now = new Date();
            const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
            rowData[i] = daysLeft;
          } catch (e) {
            rowData[i] = 'TBD';
          }
        } else {
          rowData[i] = 'TBD';
        }
      }
    });
  },

  // === VALIDATION AND HEALTH CHECK ===
  validateDualTrackColumns(sheetName) {
    try {
      const ss = CoreUtils.getSpreadsheetSafely();
      const sheet = ss.getSheetByName(sheetName || GRANT_CONFIG.SHEETS.GRANTS);
      
      if (!sheet) {
        return { valid: false, error: 'Sheet not found' };
      }
      
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const requiredDualTrackColumns = [
        'Days_Left', 'Eligible_For', 'Structure_Recommendation', 'Current_Priority', 'Foundation_Timeline',
        'LLC_Priority_Score', 'Foundation_Priority_Score', 'Overall_Strategic_Value'
      ];
      
      const missingColumns = requiredDualTrackColumns.filter(col => 
        !headers.some(header => header && header.toString().trim() === col)
      );
      
      if (missingColumns.length === 0) {
        Logger.log('✅ All dual-track columns present including Days_Left');
        return { valid: true, message: 'All dual-track columns present including Days_Left' };
      } else {
        Logger.log(`⚠️ Missing dual-track columns: ${missingColumns.join(', ')}`);
        return { 
          valid: false, 
          missing: missingColumns,
          message: `Missing columns: ${missingColumns.join(', ')}` 
        };
      }
      
    } catch (error) {
      Logger.log(`❌ Error validating dual-track columns: ${error.message}`);
      return { valid: false, error: error.message };
    }
  },

  // === SYSTEM HEALTH AND SUMMARY ===
  generateSystemSummary() {
    try {
      const ss = CoreUtils.getSpreadsheetSafely();
      const summary = {
        timestamp: new Date(),
        sheets: {},
        dualTrackStatus: {},
        recommendations: []
      };
      
      // Check each sheet
      Object.values(GRANT_CONFIG.SHEETS).forEach(sheetName => {
        const sheet = ss.getSheetByName(sheetName);
        if (sheet) {
          summary.sheets[sheetName] = {
            exists: true,
            columns: sheet.getLastColumn(),
            rows: sheet.getLastRow(),
            hasData: sheet.getLastRow() > 1
          };
          
          // Check for dual-track columns if this is a grants sheet
          if (sheetName.includes('Grants')) {
            const validation = this.validateDualTrackColumns(sheetName);
            summary.dualTrackStatus[sheetName] = validation;
          }
        } else {
          summary.sheets[sheetName] = { exists: false };
        }
      });
      
      // Generate recommendations
      if (!summary.sheets[GRANT_CONFIG.SHEETS.GRANTS]?.exists) {
        summary.recommendations.push('Run Setup System to create required sheets');
      }
      
      if (summary.dualTrackStatus[GRANT_CONFIG.SHEETS.GRANTS]?.missing?.length > 0) {
        summary.recommendations.push('Add missing dual-track columns for enhanced analysis');
      }
      
      if (!summary.sheets[GRANT_CONFIG.SHEETS.GRANTS]?.hasData) {
        summary.recommendations.push('Start adding grant opportunities to begin tracking');
      }
      
      Logger.log('✅ System summary generated');
      return summary;
      
    } catch (error) {
      Logger.log(`❌ Error generating system summary: ${error.message}`);
      return { error: error.message };
    }
  }
};

// === WRAPPER FUNCTIONS FOR MENU ACCESS ===

/**
 * Enhanced setup function that includes dual-track from the start
 */
function setupGrantsManagement() {
  return SheetManager.setupGrantsManagement();
}

/**
 * Merge new grants with enhanced dual-track support
 */
function mergeNewGrantsToMain() {
  return SheetManager.mergeNewGrants();
}

/**
 * Update days left for all grants
 */
function updateDaysLeftForAllGrants() {
  return SheetManager.updateDaysLeft();
}

/**
 * Validate dual-track system setup
 */
function validateDualTrackSystem() {
  const validation = SheetManager.validateDualTrackColumns();
  const ui = SpreadsheetApp.getUi();
  
  if (validation.valid) {
    ui.alert('✅ Validation Successful', 'Your dual-track system is properly configured and ready to use!');
  } else {
    ui.alert(
      '⚠️ Validation Issues', 
      `Dual-track validation failed:\n\n${validation.message}\n\n` +
      'Run Setup System again to ensure all columns are created.'
    );
  }
  
  return validation;
}

/**
 * Generate system health summary
 */
function generateSystemHealthSummary() {
  const summary = SheetManager.generateSystemSummary();
  const ui = SpreadsheetApp.getUi();
  
  if (summary.error) {
    ui.alert('❌ Summary Error', `Failed to generate summary: ${summary.error}`);
    return;
  }
  
  const sheetCount = Object.values(summary.sheets).filter(s => s.exists).length;
  const totalSheets = Object.keys(summary.sheets).length;
  const hasData = Object.values(summary.sheets).some(s => s.hasData);
  
  let message = `System Health Summary:\n\n`;
  message += `📊 Sheets: ${sheetCount}/${totalSheets} configured\n`;
  message += `📈 Data: ${hasData ? 'Present' : 'No data yet'}\n`;
  message += `🎯 Dual-Track: ${summary.dualTrackStatus[GRANT_CONFIG.SHEETS.GRANTS]?.valid ? 'Configured' : 'Needs setup'}\n\n`;
  
  if (summary.recommendations.length > 0) {
    message += `Recommendations:\n`;
    summary.recommendations.forEach(rec => message += `• ${rec}\n`);
  } else {
    message += `✅ System is fully configured and ready to use!`;
  }
  
  ui.alert('📊 System Health Summary', message);
  
  Logger.log('System Summary:', summary);
  return summary;
}

/**
 * Quick diagnostic function to check current system status
 */
function quickSystemDiagnostic() {
  console.log('🔍 QUICK SYSTEM DIAGNOSTIC');
  console.log('==========================');
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const mainSheet = ss.getSheetByName('Grants');
    
    if (!mainSheet) {
      console.log('❌ Main Grants sheet not found - run Setup System');
      return false;
    }
    
    const headers = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0];
    console.log(`📊 Found ${headers.length} columns in Grants sheet`);
    
    // Check for key dual-track columns including Days_Left
    const keyColumns = ['Days_Left', 'Status', 'Eligible_For', 'LLC_Priority_Score', 'Foundation_Priority_Score'];
    const found = keyColumns.filter(col => headers.includes(col));
    const missing = keyColumns.filter(col => !headers.includes(col));
    
    console.log(`✅ Found key columns: ${found.join(', ')}`);
    if (missing.length > 0) {
      console.log(`❌ Missing key columns: ${missing.join(', ')}`);
    }
    
    // Check if Days_Left is in column B
    const daysLeftIndex = headers.indexOf('Days_Left');
    console.log(`🎯 Days_Left position: ${daysLeftIndex === 1 ? 'Column B (correct)' : daysLeftIndex >= 0 ? `Column ${String.fromCharCode(65 + daysLeftIndex)} (wrong)` : 'Missing'}`);
    
    const hasFullDualTrack = headers.length >= 57; // A-BE = 57 columns
    console.log(`🎯 Dual-track complete: ${hasFullDualTrack ? 'Yes' : 'No'} (${headers.length}/57 columns)`);
    
    return hasFullDualTrack && missing.length === 0 && daysLeftIndex === 1;
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.toString());
    return false;
  }
}