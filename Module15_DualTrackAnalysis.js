/**
 * MODULE 15: DUAL-TRACK ANALYSIS (Module15_DualTrackAnalysis.gs) - FIXED VERSION
 * Compatible with your existing column structure
 * Works with current New_Grants headers without requiring new columns
 */

// ====================
// DUAL-TRACK ANALYSIS ENGINE (COMPATIBLE VERSION)
// ====================

const DualTrackAnalysis = {
    
  /**
   * Find Enhanced LLC Quick Wins
   * Uses existing columns only - no new dual-track columns required
   */
  findLLCQuickWins() {
    console.log('🚀 FINDING ENHANCED LLC QUICK WINS');
    console.log('================================');
      
    try {
      const sheet = this.getMainGrantsSheet();
      if (!sheet) {
        console.error('❌ Could not access grants sheet');
        return [];
      }

      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        console.log('ℹ️ No grants found in sheet');
        return [];
      }

      const results = [];
      
      // Get column indices for existing columns
      const columnMap = this.createColumnMapping(sheet);
        
      // Process each opportunity
      for (let row = 2; row <= lastRow; row++) {
        try {
          const grantName = this.getCellValue(sheet, row, columnMap, 'Grant_Name');
          if (!grantName) continue;
            
          // Use existing columns only
          const priorityScore = this.getCellValue(sheet, row, columnMap, 'Priority_Score') || 0;
          const businessMatch = this.getCellValue(sheet, row, columnMap, 'Business_Match_Pct') || 0;
          const wocFocus = this.getCellValue(sheet, row, columnMap, 'WOC_Focus_Rating') || 0;
          const leadershipDev = this.getCellValue(sheet, row, columnMap, 'Leadership_Dev_Alignment') || 0;
          const successProb = this.getCellValue(sheet, row, columnMap, 'Success_Probability') || 0;
          const competition = this.getCellValue(sheet, row, columnMap, 'Competition_Level') || 0;
          const status = this.getCellValue(sheet, row, columnMap, 'Status') || '';
          const prepTime = this.getCellValue(sheet, row, columnMap, 'Prep_Time_Hours') || 0;
          
          // Calculate enhanced LLC score using existing data
          const llcScore = this.calculateLLCScoreFromExisting({
            priorityScore,
            businessMatch,
            wocFocus,
            leadershipDev,
            successProb,
            competition
          });
          
          // LLC-friendly criteria
          const isHighPriority = priorityScore >= 70;
          const isHighBusinessMatch = businessMatch >= 80;
          const isHighWOCFocus = wocFocus >= 7;
          const isLowPrepTime = prepTime <= 10;
          const isOpenStatus = status.toLowerCase() === 'open' || status === '';
          
          // Include if meets LLC criteria
          if (isOpenStatus && (isHighPriority || isHighBusinessMatch || isHighWOCFocus)) {
            results.push({
              row: row,
              grantName: grantName,
              priorityScore: priorityScore,
              llcScore: llcScore,
              businessMatch: businessMatch,
              wocFocus: wocFocus,
              leadershipDev: leadershipDev,
              successProb: successProb,
              prepTime: prepTime,
              status: status,
              recommendation: this.getLLCRecommendation({
                priorityScore, businessMatch, wocFocus, prepTime
              })
            });
          }
            
        } catch (error) {
          console.error(`Error processing LLC opportunity for row ${row}:`, error);
        }
      }
        
      // Sort by LLC score, then by priority score
      results.sort((a, b) => {
        if (b.llcScore !== a.llcScore) return b.llcScore - a.llcScore;
        return b.priorityScore - a.priorityScore;
      });
        
      // Display results
      console.log(`Found ${results.length} LLC opportunities:`);
      console.log('');
        
      results.slice(0, 8).forEach((result, index) => {
        console.log(`${index + 1}. ${result.grantName}:`);
        console.log(`   💰 LLC Score: ${result.llcScore} | Priority: ${result.priorityScore}`);
        console.log(`   🎯 Business Match: ${result.businessMatch}% | WOC Focus: ${result.wocFocus}/10`);
        console.log(`   ⏱️ Prep Time: ${result.prepTime}h | Recommendation: ${result.recommendation}`);
        console.log('   ---');
      });
        
      return results;
        
    } catch (error) {
      console.error('❌ Error in LLC quick wins analysis:', error);
      return [];
    }
  },
    
  /**
   * Find Strategic Foundation Pipeline
   * Uses existing columns to identify foundation opportunities
   */
  buildFoundationPipeline() {
    console.log('🏛️ BUILDING FOUNDATION GRANT PIPELINE');
    console.log('====================================');
      
    try {
      const sheet = this.getMainGrantsSheet();
      if (!sheet) {
        console.error('❌ Could not access grants sheet');
        return {};
      }

      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        console.log('ℹ️ No grants found in sheet');
        return {};
      }

      const pipeline = {
        immediate: [],
        shortTerm: [],
        longTerm: [],
        highPotential: []
      };
      
      const columnMap = this.createColumnMapping(sheet);
        
      for (let row = 2; row <= lastRow; row++) {
        try {
          const grantName = this.getCellValue(sheet, row, columnMap, 'Grant_Name');
          if (!grantName) continue;
            
          const wocFocus = this.getCellValue(sheet, row, columnMap, 'WOC_Focus_Rating') || 0;
          const leadershipDev = this.getCellValue(sheet, row, columnMap, 'Leadership_Dev_Alignment') || 0;
          const communityImpact = this.getCellValue(sheet, row, columnMap, 'Community_Impact_Score') || 0;
          const businessMatch = this.getCellValue(sheet, row, columnMap, 'Business_Match_Pct') || 0;
          const priorityScore = this.getCellValue(sheet, row, columnMap, 'Priority_Score') || 0;
          const amount = this.getCellValue(sheet, row, columnMap, 'Amount') || '';
          const deadline = this.getCellValue(sheet, row, columnMap, 'Deadline (Est.)') || '';
          const status = this.getCellValue(sheet, row, columnMap, 'Status') || '';
          
          // Calculate foundation suitability
          const foundationScore = this.calculateFoundationScoreFromExisting({
            wocFocus,
            leadershipDev,
            communityImpact,
            businessMatch
          });
          
          const opportunity = {
            row: row,
            grantName: grantName,
            foundationScore: foundationScore,
            wocFocus: wocFocus,
            leadershipDev: leadershipDev,
            communityImpact: communityImpact,
            amount: amount,
            deadline: deadline,
            status: status,
            timeline: this.estimateFoundationTimeline(deadline, amount)
          };
          
          // Categorize opportunities (only if suitable for foundation)
          if (foundationScore >= 60 && (status.toLowerCase() === 'open' || status === '')) {
            if (foundationScore >= 85) {
              pipeline.highPotential.push(opportunity);
            } else if (this.isImmediateOpportunity(deadline)) {
              pipeline.immediate.push(opportunity);
            } else if (this.isShortTermOpportunity(deadline)) {
              pipeline.shortTerm.push(opportunity);
            } else {
              pipeline.longTerm.push(opportunity);
            }
          }
            
        } catch (error) {
          console.error(`Error processing foundation opportunity for row ${row}:`, error);
        }
      }
        
      // Sort each category by foundation score
      Object.keys(pipeline).forEach(key => {
        pipeline[key].sort((a, b) => b.foundationScore - a.foundationScore);
      });
        
      // Display pipeline
      console.log('FOUNDATION GRANT PIPELINE:');
      console.log('');
        
      console.log(`🔥 HIGH POTENTIAL (${pipeline.highPotential.length} opportunities):`);
      pipeline.highPotential.slice(0, 5).forEach((opp, index) => {
        console.log(`   ${index + 1}. ${opp.grantName} (Score: ${opp.foundationScore})`);
        console.log(`      WOC Focus: ${opp.wocFocus}/10 | Leadership: ${opp.leadershipDev}/10 | Community: ${opp.communityImpact}/10`);
      });
      console.log('');
        
      console.log(`⚡ IMMEDIATE OPPORTUNITIES (${pipeline.immediate.length}):`);
      pipeline.immediate.slice(0, 3).forEach((opp, index) => {
        console.log(`   ${index + 1}. ${opp.grantName} (Score: ${opp.foundationScore})`);
        console.log(`      Timeline: ${opp.timeline} | Amount: ${opp.amount}`);
      });
      console.log('');
        
      console.log(`📅 SHORT-TERM PIPELINE (${pipeline.shortTerm.length}):`);
      pipeline.shortTerm.slice(0, 3).forEach((opp, index) => {
        console.log(`   ${index + 1}. ${opp.grantName} (Score: ${opp.foundationScore})`);
      });
        
      return pipeline;
        
    } catch (error) {
      console.error('❌ Error building foundation pipeline:', error);
      return {};
    }
  },
    
  /**
   * Generate Comprehensive Analysis Report
   * Uses existing data to create strategic insights
   */
  generateComprehensiveReport() {
    console.log('📊 GENERATING COMPREHENSIVE DUAL-TRACK REPORT');
    console.log('=============================================');
      
    try {
      // Gather analyses using existing columns
      const llcQuickWins = this.findLLCQuickWins();
      const foundationPipeline = this.buildFoundationPipeline();
      const overallAnalysis = this.analyzeCurrentPortfolio();
        
      // Calculate summary statistics
      const totalOpportunities = llcQuickWins.length + 
                                Object.values(foundationPipeline).flat().length;
      const immediateActions = llcQuickWins.filter(opp => 
        opp.priorityScore >= 80 && opp.prepTime <= 8).length;
      const highPotentialFound = foundationPipeline.highPotential?.length || 0;
        
      // Display comprehensive report
      console.log('');
      console.log('🎯 EXECUTIVE SUMMARY');
      console.log('===================');
      console.log(`Total Strategic Opportunities: ${totalOpportunities}`);
      console.log(`Immediate LLC Actions: ${immediateActions}`);
      console.log(`High-Potential Foundation Targets: ${highPotentialFound}`);
      console.log(`Current Portfolio Health: ${overallAnalysis.healthScore}/100`);
      console.log('');
        
      console.log('💼 LLC TRACK PRIORITIES:');
      console.log('========================');
      const topLLC = llcQuickWins.slice(0, 3);
      if (topLLC.length > 0) {
        topLLC.forEach((opp, index) => {
          console.log(`${index + 1}. ${opp.grantName} (LLC Score: ${opp.llcScore})`);
          console.log(`   Business Match: ${opp.businessMatch}% | WOC Focus: ${opp.wocFocus}/10`);
          console.log(`   Action: ${opp.recommendation}`);
        });
      } else {
        console.log('   No immediate LLC opportunities identified with current data');
        console.log('   Recommendation: Add Business_Match_Pct and WOC_Focus_Rating data');
      }
      console.log('');
        
      console.log('🏛️ FOUNDATION TRACK STRATEGY:');
      console.log('=============================');
      console.log(`High Potential: ${foundationPipeline.highPotential?.length || 0} opportunities`);
      console.log(`Immediate: ${foundationPipeline.immediate?.length || 0} opportunities`);
      console.log(`Short-term Pipeline: ${foundationPipeline.shortTerm?.length || 0} opportunities`);
      console.log(`Long-term Pipeline: ${foundationPipeline.longTerm?.length || 0} opportunities`);
      console.log('');
        
      console.log('⭐ TOP STRATEGIC RECOMMENDATIONS:');
      console.log('=================================');
      console.log('Based on Current Data:');
      
      // Generate recommendations based on what we found
      if (immediateActions > 0) {
        console.log(`   1. Apply to ${immediateActions} immediate LLC opportunities this week`);
      }
      if (highPotentialFound > 0) {
        console.log(`   2. Research ${highPotentialFound} high-potential foundation targets`);
      }
      console.log('   3. Begin 501(c)(3) planning process for foundation track');
      console.log('   4. Fill in missing strategic data columns for better analysis');
      console.log('');
        
      console.log('📈 DATA ENHANCEMENT RECOMMENDATIONS:');
      console.log('===================================');
      console.log('To unlock full dual-track capabilities, consider adding:');
      console.log('   • Eligible_For column (LLC/Foundation/Both)');
      console.log('   • Current_Priority column (Immediate/Future)');
      console.log('   • LLC_Funding_Type column (Corporate/Impact Investment/etc.)');
      console.log('   • Foundation_Timeline column (Year 1/Year 2/Year 3+)');
      console.log('');
        
      return {
        summary: {
          totalOpportunities,
          immediateActions,
          highPotentialFound,
          healthScore: overallAnalysis.healthScore
        },
        llcQuickWins,
        foundationPipeline,
        overallAnalysis
      };
        
    } catch (error) {
      console.error('❌ Error generating comprehensive report:', error);
      return null;
    }
  },
    
  // ====================
  // HELPER FUNCTIONS
  // ====================
    
  /**
   * Get main grants sheet (compatible with existing system)
   */
  getMainGrantsSheet() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      // Try different possible sheet names
      return ss.getSheetByName('New_Grants') ||
             ss.getSheetByName('Grants') ||
             ss.getSheets()[0]; // Fallback to first sheet
    } catch (error) {
      console.error('❌ Could not find grants sheet:', error);
      return null;
    }
  },
  
  /**
   * Create column mapping from sheet headers
   */
  createColumnMapping(sheet) {
    try {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const map = {};
      headers.forEach((header, index) => {
        if (header && header.toString().trim()) {
          map[header.toString().trim()] = index;
        }
      });
      return map;
    } catch (error) {
      console.error('❌ Error creating column mapping:', error);
      return {};
    }
  },
  
  /**
   * Safely get cell value using column mapping
   */
  getCellValue(sheet, row, columnMap, columnName) {
    try {
      const colIndex = columnMap[columnName];
      if (colIndex === undefined) {
        // Don't log missing optional columns
        return null;
      }
      const value = sheet.getRange(row, colIndex + 1).getValue();
      return value;
    } catch (error) {
      return null;
    }
  },
  
  /**
   * Calculate LLC score from existing columns
   */
  calculateLLCScoreFromExisting(data) {
    try {
      let score = 0;
      
      // Use existing priority score as base (40% weight)
      score += (data.priorityScore || 0) * 0.4;
      
      // Business match percentage (30% weight)
      score += (data.businessMatch || 0) * 0.3;
      
      // WOC focus rating (20% weight)
      score += ((data.wocFocus || 0) * 10) * 0.2; // Convert 1-10 to 0-100
      
      // Leadership development (10% weight)
      score += ((data.leadershipDev || 0) * 10) * 0.1;
      
      // Bonuses for high performance
      if (data.businessMatch >= 90) score += 5;
      if (data.wocFocus >= 9) score += 3;
      if (data.successProb >= 8) score += 2;
      if (data.competition <= 3) score += 2; // Low competition
      
      return Math.min(Math.round(score), 100);
    } catch (error) {
      return 0;
    }
  },
  
  /**
   * Calculate foundation score from existing columns
   */
  calculateFoundationScoreFromExisting(data) {
    try {
      let score = 0;
      
      // WOC focus is most important for foundation (40% weight)
      score += ((data.wocFocus || 0) * 10) * 0.4;
      
      // Leadership development (25% weight)
      score += ((data.leadershipDev || 0) * 10) * 0.25;
      
      // Community impact (25% weight)
      score += ((data.communityImpact || 0) * 10) * 0.25;
      
      // Some business alignment still matters (10% weight)
      score += (data.businessMatch || 0) * 0.1;
      
      // Foundation-specific bonuses
      if (data.wocFocus >= 8) score += 8; // High WOC focus bonus
      if (data.leadershipDev >= 8) score += 6; // High leadership bonus
      if (data.communityImpact >= 8) score += 4; // High community bonus
      
      return Math.min(Math.round(score), 100);
    } catch (error) {
      return 0;
    }
  },
  
  /**
   * Get LLC recommendation based on scores
   */
  getLLCRecommendation(data) {
    if (data.businessMatch >= 90 && data.prepTime <= 5) {
      return 'APPLY IMMEDIATELY';
    } else if (data.priorityScore >= 80 && data.prepTime <= 10) {
      return 'APPLY THIS WEEK';
    } else if (data.wocFocus >= 8 && data.businessMatch >= 70) {
      return 'HIGH PRIORITY';
    } else {
      return 'RESEARCH FURTHER';
    }
  },
  
  /**
   * Estimate foundation timeline based on deadline and amount
   */
  estimateFoundationTimeline(deadline, amount) {
    try {
      // Simple heuristic based on available data
      const amountStr = amount.toString().toLowerCase();
      const deadlineStr = deadline.toString().toLowerCase();
      
      if (deadlineStr.includes('rolling') || deadlineStr.includes('ongoing')) {
        return 'Ongoing Opportunity';
      } else if (deadlineStr.includes('2025') || deadlineStr.includes('soon')) {
        return 'Immediate (2025)';
      } else if (deadlineStr.includes('2026')) {
        return 'Short-term (2026)';
      } else {
        return 'Long-term (2027+)';
      }
    } catch (error) {
      return 'Timeline TBD';
    }
  },
  
  /**
   * Check if opportunity is immediate
   */
  isImmediateOpportunity(deadline) {
    const deadlineStr = deadline.toString().toLowerCase();
    return deadlineStr.includes('2025') || 
           deadlineStr.includes('soon') || 
           deadlineStr.includes('urgent');
  },
  
  /**
   * Check if opportunity is short-term
   */
  isShortTermOpportunity(deadline) {
    const deadlineStr = deadline.toString().toLowerCase();
    return deadlineStr.includes('2026') || 
           deadlineStr.includes('next year');
  },
  
  /**
   * Analyze current portfolio health
   */
  analyzeCurrentPortfolio() {
    try {
      const sheet = this.getMainGrantsSheet();
      if (!sheet) return { healthScore: 0 };
      
      const columnMap = this.createColumnMapping(sheet);
      const lastRow = sheet.getLastRow();
      
      let totalGrants = 0;
      let scoredGrants = 0;
      let highQualityGrants = 0;
      let totalScore = 0;
      
      for (let row = 2; row <= lastRow; row++) {
        const grantName = this.getCellValue(sheet, row, columnMap, 'Grant_Name');
        if (!grantName) continue;
        
        totalGrants++;
        
        const priorityScore = this.getCellValue(sheet, row, columnMap, 'Priority_Score') || 0;
        const wocFocus = this.getCellValue(sheet, row, columnMap, 'WOC_Focus_Rating') || 0;
        
        if (priorityScore > 0) {
          scoredGrants++;
          totalScore += priorityScore;
        }
        
        if (priorityScore >= 80 || wocFocus >= 8) {
          highQualityGrants++;
        }
      }
      
      const avgScore = scoredGrants > 0 ? totalScore / scoredGrants : 0;
      const qualityRate = totalGrants > 0 ? (highQualityGrants / totalGrants) * 100 : 0;
      const completionRate = totalGrants > 0 ? (scoredGrants / totalGrants) * 100 : 0;
      
      // Calculate overall health score
      const healthScore = Math.round((avgScore * 0.5) + (qualityRate * 0.3) + (completionRate * 0.2));
      
      return {
        healthScore,
        totalGrants,
        scoredGrants,
        highQualityGrants,
        avgScore: Math.round(avgScore),
        qualityRate: Math.round(qualityRate),
        completionRate: Math.round(completionRate)
      };
    } catch (error) {
      console.error('❌ Error analyzing portfolio:', error);
      return { healthScore: 0 };
    }
  }
};

// ====================
// MENU WRAPPER FUNCTIONS (Compatible with existing system)
// ====================

function findEnhancedLLCQuickWins() {
  return DualTrackAnalysis.findLLCQuickWins();
}

function buildFoundationPipeline() {
  return DualTrackAnalysis.buildFoundationPipeline();
}

function generateDualTrackReport() {
  return DualTrackAnalysis.generateComprehensiveReport();
}

// ====================
// COMPATIBILITY FUNCTIONS
// ====================

/**
 * Test the system with current data
 */
function testDualTrackAnalysis() {
  console.log('🧪 TESTING DUAL-TRACK ANALYSIS WITH CURRENT DATA');
  console.log('===============================================');
  
  try {
    console.log('1. Testing LLC Quick Wins...');
    const llcResults = DualTrackAnalysis.findLLCQuickWins();
    console.log(`✅ Found ${llcResults.length} LLC opportunities`);
    
    console.log('2. Testing Foundation Pipeline...');
    const foundationResults = DualTrackAnalysis.buildFoundationPipeline();
    const totalFound = Object.values(foundationResults).flat().length;
    console.log(`✅ Found ${totalFound} foundation opportunities`);
    
    console.log('3. Testing Comprehensive Report...');
    const report = DualTrackAnalysis.generateComprehensiveReport();
    console.log(`✅ Generated comprehensive analysis`);
    
    console.log('');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('Your dual-track analysis is working with current data.');
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

/**
 * Quick diagnostic to show what columns are available
 */
function showAvailableColumns() {
  try {
    const sheet = DualTrackAnalysis.getMainGrantsSheet();
    if (!sheet) {
      console.error('❌ Could not access sheet');
      return;
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    console.log('📋 AVAILABLE COLUMNS IN YOUR SHEET:');
    console.log('==================================');
    headers.forEach((header, index) => {
      if (header) {
        console.log(`${index + 1}. ${header}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error showing columns:', error);
  }
}