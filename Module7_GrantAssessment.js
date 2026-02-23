/**
 * MODULE 7: GRANT ASSESSMENT (Module7_GrantAssessment.gs)
 * 
 * Analyzes and scores grant opportunities for Elevated Movements
 * Provides strategic assessment, priority scoring, and recommendation generation
 */

const GrantAssessment = {
  
  /**
   * Main assessment function - analyzes all grants in New_Grants sheet
   */
  assessGrants() {
    const ui = SpreadsheetApp.getUi();
    
    ui.alert('🎯 Starting Grant Assessment',
      'Analyzing grant opportunities for strategic fit...\n\n' +
      '📊 Calculating priority scores\n' +
      '🎯 Assessing business alignment\n' +
      '💡 Generating recommendations\n' +
      '⭐ Rating WOC focus and leadership potential\n\n' +
      'This will take 3-5 minutes.',
      ui.ButtonSet.OK);

    try {
      const results = this.runComprehensiveAssessment();
      
      if (results.success) {
        ui.alert('✅ Assessment Complete!',
          `Successfully assessed ${results.grantsProcessed} grants!\n\n` +
          `🎯 High Priority: ${results.highPriority} grants\n` +
          `⭐ Excellent Fit: ${results.excellentFit} grants\n` +
          `💼 Business Match: ${results.avgBusinessMatch}% average\n\n` +
          '📊 Check Priority_Score column for rankings\n' +
          '💡 Review WOC_Focus_Rating for strategic alignment',
          ui.ButtonSet.OK);
      } else {
        ui.alert('⚠️ Assessment Issues',
          `Assessment completed with some issues:\n\n` +
          `✅ Processed: ${results.grantsProcessed} grants\n` +
          `❌ Errors: ${results.errors} grants\n\n` +
          'Check execution log for details.',
          ui.ButtonSet.OK);
      }

      CoreUtils.logSystemEvent('Grant Assessment', 'Success', 
        `Assessed ${results.grantsProcessed} grants`);

    } catch (error) {
      Logger.log(`❌ Assessment error: ${error.message}`);
      ui.alert('❌ Assessment Error',
        `Grant assessment failed: ${error.message}`,
        ui.ButtonSet.OK);
    }
  },

  /**
   * Run comprehensive assessment on all grants
   */
  runComprehensiveAssessment() {
    try {
      const ss = CoreUtils.getSpreadsheetSafely();
      const sheet = ss.getSheetByName(GRANT_CONFIG.SHEETS.NEW_GRANTS);
      
      if (!sheet) {
        throw new Error('New_Grants sheet not found');
      }

      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        throw new Error('No grants found to assess');
      }

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const columnMap = this.createColumnMapping(headers);
      
      let grantsProcessed = 0;
      let errors = 0;
      let highPriority = 0;
      let excellentFit = 0;
      let totalBusinessMatch = 0;

      // Process each grant row
      for (let row = 2; row <= lastRow; row++) {
        try {
          const grantData = this.getGrantData(sheet, row, columnMap);
          
          if (!grantData.grantName) {
            continue; // Skip empty rows
          }

          // Calculate assessment scores
          const assessment = this.calculateGrantScores(grantData);
          
          // Update the sheet with scores
          this.updateGrantScores(sheet, row, columnMap, assessment);
          
          // Track statistics
          grantsProcessed++;
          if (assessment.priorityScore >= 80) highPriority++;
          if (assessment.wocFocusRating >= 8) excellentFit++;
          totalBusinessMatch += assessment.businessMatchPct;

          // Log progress
          if (grantsProcessed % 5 === 0) {
            console.log(`✅ Assessed ${grantsProcessed} grants...`);
          }

        } catch (error) {
          console.error(`❌ Error assessing grant in row ${row}:`, error);
          errors++;
        }
      }

      const avgBusinessMatch = grantsProcessed > 0 ? 
        Math.round(totalBusinessMatch / grantsProcessed) : 0;

      return {
        success: errors < grantsProcessed * 0.5, // Success if less than 50% errors
        grantsProcessed,
        errors,
        highPriority,
        excellentFit,
        avgBusinessMatch
      };

    } catch (error) {
      console.error('❌ Comprehensive assessment failed:', error);
      throw error;
    }
  },

  /**
   * Get grant data from a row
   */
  getGrantData(sheet, row, columnMap) {
    return {
      grantName: this.getCellValue(sheet, row, columnMap, 'Grant_Name') || '',
      sponsorOrg: this.getCellValue(sheet, row, columnMap, 'Sponsor_Org') || '',
      focusArea: this.getCellValue(sheet, row, columnMap, 'Focus_Area') || '',
      amount: this.getCellValue(sheet, row, columnMap, 'Amount') || '',
      deadline: this.getCellValue(sheet, row, columnMap, 'Deadline (Est.)') || '',
      eligibility: this.getCellValue(sheet, row, columnMap, 'Eligibility Summary') || '',
      notes: this.getCellValue(sheet, row, columnMap, 'Notes') || '',
      discoverySource: this.getCellValue(sheet, row, columnMap, 'Discovery_Source') || '',
      sourceReliability: this.getCellValue(sheet, row, columnMap, 'Source_Reliability_Score') || 5
    };
  },

  /**
   * Calculate comprehensive scores for a grant
   */
  calculateGrantScores(grantData) {
    const scores = {
      priorityScore: 0,
      businessMatchPct: 0,
      wocFocusRating: 0,
      leadershipDevAlignment: 0,
      communityImpactScore: 0,
      prepTimeHours: 0,
      complexityRating: 0,
      successProbability: 0,
      competitionLevel: 0
    };

    // Calculate priority score (primary metric)
    scores.priorityScore = this.calculatePriorityScore(grantData);
    
    // Calculate business match percentage
    scores.businessMatchPct = this.calculateBusinessMatch(grantData);
    
    // Calculate WOC focus rating (key for Elevated Movements)
    scores.wocFocusRating = this.calculateWOCFocus(grantData);
    
    // Calculate leadership development alignment
    scores.leadershipDevAlignment = this.calculateLeadershipAlignment(grantData);
    
    // Calculate community impact score
    scores.communityImpactScore = this.calculateCommunityImpact(grantData);
    
    // Estimate preparation time
    scores.prepTimeHours = this.estimatePrepTime(grantData);
    
    // Rate complexity
    scores.complexityRating = this.rateComplexity(grantData);
    
    // Estimate success probability
    scores.successProbability = this.estimateSuccessProbability(grantData);
    
    // Assess competition level
    scores.competitionLevel = this.assessCompetitionLevel(grantData);

    return scores;
  },

  /**
   * Calculate priority score (0-100)
   */
  calculatePriorityScore(grantData) {
    let score = 50; // Base score
    
    const allText = (
      grantData.grantName + ' ' + 
      grantData.focusArea + ' ' + 
      grantData.eligibility + ' ' + 
      grantData.notes
    ).toLowerCase();

    // WOC and diversity focus (high weight)
    if (allText.includes('women of color') || allText.includes('woc')) score += 20;
    if (allText.includes('black women') || allText.includes('african american women')) score += 18;
    if (allText.includes('diverse') || allText.includes('diversity')) score += 12;
    if (allText.includes('minority women') || allText.includes('underrepresented')) score += 15;

    // Business alignment
    if (allText.includes('coaching') || allText.includes('wellness')) score += 15;
    if (allText.includes('leadership') || allText.includes('professional development')) score += 12;
    if (allText.includes('small business') || allText.includes('entrepreneur')) score += 10;
    if (allText.includes('burnout') || allText.includes('mental health')) score += 8;

    // Geographic alignment
    if (allText.includes('california') || allText.includes('west coast')) score += 8;
    if (allText.includes('silicon valley') || allText.includes('bay area')) score += 10;
    if (allText.includes('national') || allText.includes('nationwide')) score += 5;

    // Funding amount bonus
    const amountText = grantData.amount.toString().toLowerCase();
    if (amountText.includes('50') && amountText.includes('000')) score += 8; // $50k range
    if (amountText.includes('100') && amountText.includes('000')) score += 10; // $100k range
    
    // Source reliability bonus
    const reliability = parseInt(grantData.sourceReliability) || 5;
    if (reliability >= 9) score += 5;
    if (reliability >= 8) score += 3;

    // Deadline urgency
    const deadline = grantData.deadline.toLowerCase();
    if (deadline.includes('2025') || deadline.includes('soon')) score += 5;
    if (deadline.includes('rolling') || deadline.includes('ongoing')) score += 3;

    return Math.min(Math.max(score, 0), 100);
  },

  /**
   * Calculate business match percentage (0-100)
   */
  calculateBusinessMatch(grantData) {
    let match = 40; // Base match
    
    const allText = (
      grantData.grantName + ' ' + 
      grantData.focusArea + ' ' + 
      grantData.eligibility
    ).toLowerCase();

    // Core business alignment
    if (allText.includes('coaching')) match += 25;
    if (allText.includes('wellness') || allText.includes('health')) match += 20;
    if (allText.includes('leadership development') || allText.includes('professional development')) match += 20;
    if (allText.includes('burnout') || allText.includes('stress')) match += 15;

    // Target audience alignment
    if (allText.includes('women') && allText.includes('color')) match += 20;
    if (allText.includes('women') && allText.includes('professional')) match += 15;
    if (allText.includes('working women') || allText.includes('career women')) match += 15;

    // Business structure alignment
    if (allText.includes('llc') || allText.includes('small business')) match += 10;
    if (allText.includes('service business') || allText.includes('consulting')) match += 10;
    if (allText.includes('501c3') || allText.includes('nonprofit')) match += 5; // Future consideration

    // Industry alignment
    if (allText.includes('technology') || allText.includes('tech')) match += 8;
    if (allText.includes('education') || allText.includes('training')) match += 8;
    if (allText.includes('community') || allText.includes('social impact')) match += 7;

    return Math.min(Math.max(match, 0), 100);
  },

  /**
   * Calculate WOC focus rating (1-10)
   */
  calculateWOCFocus(grantData) {
    let rating = 3; // Base rating
    
    const allText = (
      grantData.grantName + ' ' + 
      grantData.sponsorOrg + ' ' + 
      grantData.focusArea + ' ' + 
      grantData.eligibility
    ).toLowerCase();

    // Explicit WOC focus
    if (allText.includes('women of color') || allText.includes('woc')) rating += 4;
    if (allText.includes('black women') || allText.includes('african american women')) rating += 3;
    if (allText.includes('latina women') || allText.includes('hispanic women')) rating += 3;
    if (allText.includes('asian women') || allText.includes('indigenous women')) rating += 3;

    // Diversity and inclusion focus
    if (allText.includes('diversity') || allText.includes('inclusion')) rating += 2;
    if (allText.includes('equity') || allText.includes('underrepresented')) rating += 2;
    if (allText.includes('minority women') || allText.includes('marginalized')) rating += 2;

    // General women focus
    if (allText.includes('women') && !allText.includes('color')) rating += 1;
    if (allText.includes('female entrepreneurs') || allText.includes('women business')) rating += 1;

    // Bonus for specific programs
    if (allText.includes('women\'s fund') || allText.includes('foundation for women')) rating += 1;
    if (allText.includes('minority business') || allText.includes('diverse supplier')) rating += 1;

    return Math.min(Math.max(rating, 1), 10);
  },

  /**
   * Calculate leadership development alignment (1-10)
   */
  calculateLeadershipAlignment(grantData) {
    let alignment = 3; // Base alignment
    
    const allText = (
      grantData.grantName + ' ' + 
      grantData.focusArea + ' ' + 
      grantData.eligibility
    ).toLowerCase();

    // Direct leadership focus
    if (allText.includes('leadership development') || allText.includes('leadership training')) alignment += 4;
    if (allText.includes('leadership') && allText.includes('women')) alignment += 3;
    if (allText.includes('executive development') || allText.includes('management training')) alignment += 3;

    // Professional development
    if (allText.includes('professional development') || allText.includes('career development')) alignment += 3;
    if (allText.includes('skill building') || allText.includes('capacity building')) alignment += 2;
    if (allText.includes('mentorship') || allText.includes('coaching')) alignment += 2;

    // Specific leadership areas
    if (allText.includes('entrepreneurship') || allText.includes('business leadership')) alignment += 2;
    if (allText.includes('community leadership') || allText.includes('civic leadership')) alignment += 2;
    if (allText.includes('innovation') || allText.includes('change management')) alignment += 1;

    return Math.min(Math.max(alignment, 1), 10);
  },

  /**
   * Calculate community impact score (1-10)
   */
  calculateCommunityImpact(grantData) {
    let impact = 4; // Base impact
    
    const allText = (
      grantData.grantName + ' ' + 
      grantData.focusArea + ' ' + 
      grantData.eligibility
    ).toLowerCase();

    // Direct community focus
    if (allText.includes('community') && allText.includes('impact')) impact += 3;
    if (allText.includes('community development') || allText.includes('community building')) impact += 3;
    if (allText.includes('social impact') || allText.includes('social change')) impact += 3;

    // Specific impact areas
    if (allText.includes('empowerment') || allText.includes('empowering')) impact += 2;
    if (allText.includes('education') || allText.includes('workforce development')) impact += 2;
    if (allText.includes('economic development') || allText.includes('economic empowerment')) impact += 2;

    // Scale indicators
    if (allText.includes('multiple') || allText.includes('many') || allText.includes('hundreds')) impact += 1;
    if (allText.includes('regional') || allText.includes('statewide') || allText.includes('national')) impact += 1;

    return Math.min(Math.max(impact, 1), 10);
  },

  /**
   * Estimate preparation time in hours
   */
  estimatePrepTime(grantData) {
    let hours = 8; // Base preparation time
    
    const allText = (
      grantData.grantName + ' ' + 
      grantData.eligibility
    ).toLowerCase();

    // Complexity indicators
    if (allText.includes('detailed') || allText.includes('comprehensive')) hours += 6;
    if (allText.includes('budget') || allText.includes('financial')) hours += 4;
    if (allText.includes('references') || allText.includes('letters')) hours += 3;
    if (allText.includes('proposal') || allText.includes('application')) hours += 2;

    // Amount-based complexity
    const amountText = grantData.amount.toString();
    if (amountText.includes('100') && amountText.includes('000')) hours += 8; // $100k+
    if (amountText.includes('50') && amountText.includes('000')) hours += 4;   // $50k+
    if (amountText.includes('25') && amountText.includes('000')) hours += 2;   // $25k+

    // Simplicity indicators
    if (allText.includes('simple') || allText.includes('basic')) hours -= 3;
    if (allText.includes('one page') || allText.includes('short')) hours -= 4;
    if (allText.includes('online') || allText.includes('electronic')) hours -= 2;

    return Math.min(Math.max(hours, 1), 40);
  },

  /**
   * Rate application complexity (1-10)
   */
  rateComplexity(grantData) {
    let complexity = 4; // Base complexity
    
    const allText = (
      grantData.grantName + ' ' + 
      grantData.eligibility
    ).toLowerCase();

    // High complexity indicators
    if (allText.includes('federal') || allText.includes('government')) complexity += 3;
    if (allText.includes('research') || allText.includes('data')) complexity += 2;
    if (allText.includes('multiple') && allText.includes('phase')) complexity += 2;
    if (allText.includes('partnership') || allText.includes('collaboration')) complexity += 2;

    // Medium complexity indicators
    if (allText.includes('foundation') || allText.includes('private')) complexity += 1;
    if (allText.includes('report') || allText.includes('outcome')) complexity += 1;

    // Low complexity indicators
    if (allText.includes('small') || allText.includes('micro')) complexity -= 1;
    if (allText.includes('startup') || allText.includes('emerging')) complexity -= 1;
    if (allText.includes('application') && allText.includes('simple')) complexity -= 2;

    return Math.min(Math.max(complexity, 1), 10);
  },

  /**
   * Estimate success probability (1-10)
   */
  estimateSuccessProbability(grantData) {
    let probability = 5; // Base probability
    
    const allText = (
      grantData.grantName + ' ' + 
      grantData.focusArea + ' ' + 
      grantData.eligibility
    ).toLowerCase();

    // High success indicators
    if (allText.includes('women of color') && allText.includes('coaching')) probability += 3;
    if (allText.includes('leadership') && allText.includes('wellness')) probability += 2;
    if (allText.includes('california') || allText.includes('local')) probability += 2;
    if (allText.includes('small business') && allText.includes('llc')) probability += 2;

    // Medium success indicators
    if (allText.includes('women') && allText.includes('entrepreneur')) probability += 1;
    if (allText.includes('diversity') || allText.includes('inclusion')) probability += 1;
    if (allText.includes('professional development')) probability += 1;

    // Competition level adjustment
    if (allText.includes('competitive') || allText.includes('selective')) probability -= 2;
    if (allText.includes('limited') && allText.includes('award')) probability -= 1;
    if (allText.includes('rolling') || allText.includes('multiple')) probability += 1;

    // Source reliability adjustment
    const reliability = parseInt(grantData.sourceReliability) || 5;
    if (reliability >= 9) probability += 1;
    if (reliability <= 6) probability -= 1;

    return Math.min(Math.max(probability, 1), 10);
  },

  /**
   * Assess competition level (1-10, where 10 = very competitive)
   */
  assessCompetitionLevel(grantData) {
    let competition = 5; // Base competition level
    
    const allText = (
      grantData.grantName + ' ' + 
      grantData.sponsorOrg + ' ' + 
      grantData.eligibility
    ).toLowerCase();

    // High competition indicators
    if (allText.includes('national') || allText.includes('federal')) competition += 3;
    if (allText.includes('prestigious') || allText.includes('competitive')) competition += 2;
    if (allText.includes('limited') && allText.includes('award')) competition += 2;
    if (allText.includes('large') && allText.includes('amount')) competition += 1;

    // Medium competition indicators
    if (allText.includes('regional') || allText.includes('state')) competition += 1;
    if (allText.includes('foundation') || allText.includes('corporate')) competition += 1;

    // Low competition indicators
    if (allText.includes('local') || allText.includes('community')) competition -= 1;
    if (allText.includes('small') || allText.includes('micro')) competition -= 2;
    if (allText.includes('rolling') || allText.includes('ongoing')) competition -= 1;
    if (allText.includes('specific') && allText.includes('criteria')) competition -= 1;

    return Math.min(Math.max(competition, 1), 10);
  },

  /**
   * Update grant scores in the sheet
   */
  updateGrantScores(sheet, row, columnMap, assessment) {
    try {
      // Update all calculated scores
      this.setCellValue(sheet, row, columnMap, 'Priority_Score', assessment.priorityScore);
      this.setCellValue(sheet, row, columnMap, 'Business_Match_Pct', assessment.businessMatchPct);
      this.setCellValue(sheet, row, columnMap, 'WOC_Focus_Rating', assessment.wocFocusRating);
      this.setCellValue(sheet, row, columnMap, 'Leadership_Dev_Alignment', assessment.leadershipDevAlignment);
      this.setCellValue(sheet, row, columnMap, 'Community_Impact_Score', assessment.communityImpactScore);
      this.setCellValue(sheet, row, columnMap, 'Prep_Time_Hours', assessment.prepTimeHours);
      this.setCellValue(sheet, row, columnMap, 'Complexity_Rating', assessment.complexityRating);
      this.setCellValue(sheet, row, columnMap, 'Success_Probability', assessment.successProbability);
      this.setCellValue(sheet, row, columnMap, 'Competition_Level', assessment.competitionLevel);

      // Update timestamp
      this.setCellValue(sheet, row, columnMap, 'Last_Updated', new Date().toISOString().split('T')[0]);

    } catch (error) {
      console.error(`❌ Error updating scores for row ${row}:`, error);
    }
  },

  /**
   * Helper functions for sheet operations
   */
  createColumnMapping(headers) {
    const map = {};
    headers.forEach((header, index) => {
      if (header && header.toString().trim()) {
        map[header.toString().trim()] = index;
      }
    });
    return map;
  },

  getCellValue(sheet, row, columnMap, columnName) {
    try {
      const colIndex = columnMap[columnName];
      if (colIndex === undefined) return null;
      return sheet.getRange(row, colIndex + 1).getValue();
    } catch (error) {
      return null;
    }
  },

  setCellValue(sheet, row, columnMap, columnName, value) {
    try {
      const colIndex = columnMap[columnName];
      if (colIndex !== undefined) {
        sheet.getRange(row, colIndex + 1).setValue(value);
        return true;
      }
    } catch (error) {
      console.error(`❌ Error setting ${columnName}:`, error);
    }
    return false;
  },

  /**
   * Quick assessment for top grants only
   */
  assessTopGrants() {
    const ui = SpreadsheetApp.getUi();
    
    ui.alert('🔥 Quick Top Grant Assessment',
      'Analyzing your highest priority grants only...\n\n' +
      'This will focus on grants most likely to succeed.',
      ui.ButtonSet.OK);

    try {
      const ss = CoreUtils.getSpreadsheetSafely();
      const sheet = ss.getSheetByName(GRANT_CONFIG.SHEETS.NEW_GRANTS);
      
      if (!sheet || sheet.getLastRow() <= 1) {
        ui.alert('No Grants Found', 'No grants found to assess.', ui.ButtonSet.OK);
        return;
      }

      // Get all grant data and calculate quick scores
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const columnMap = this.createColumnMapping(headers);
      const grants = [];

      for (let row = 2; row <= sheet.getLastRow(); row++) {
        const grantData = this.getGrantData(sheet, row, columnMap);
        if (grantData.grantName) {
          const quickScore = this.calculatePriorityScore(grantData);
          grants.push({ row, data: grantData, score: quickScore });
        }
      }

      // Sort by score and take top 5
      grants.sort((a, b) => b.score - a.score);
      const topGrants = grants.slice(0, 5);

      // Assess top grants in detail
      let assessed = 0;
      topGrants.forEach(grant => {
        try {
          const assessment = this.calculateGrantScores(grant.data);
          this.updateGrantScores(sheet, grant.row, columnMap, assessment);
          assessed++;
        } catch (error) {
          console.error(`❌ Error assessing top grant:`, error);
        }
      });

      ui.alert('✅ Top Grant Assessment Complete!',
        `Assessed ${assessed} top priority grants!\n\n` +
        '🎯 Focus on these highest-scoring opportunities\n' +
        '📊 Check Priority_Score column for rankings',
        ui.ButtonSet.OK);

    } catch (error) {
      ui.alert('❌ Assessment Error', `Top grant assessment failed: ${error.message}`, ui.ButtonSet.OK);
    }
  }
};

// ====================
// GLOBAL MENU FUNCTIONS
// ====================

function assessGrants() {
  return GrantAssessment.assessGrants();
}

function assessTopGrants() {
  return GrantAssessment.assessTopGrants();
}

function calculateGrantPriority() {
  return GrantAssessment.assessTopGrants();
}

// ====================
// MODULE COMPLETION
// ====================

console.log('✅ GrantAssessment Module (Module7) - Ready');
console.log('🎯 Strategic grant scoring and analysis system');
console.log('📊 Comprehensive assessment capabilities');
console.log('🚀 Optimized for Elevated Movements mission!');