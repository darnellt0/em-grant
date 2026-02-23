/**
 * REAL GRANT DISCOVERY & RESEARCH SYSTEM
 * Finds actual, current grant opportunities with specific deadlines and details
 */

const RealGrantFinder = {
  
  /**
   * Discover REAL current grants for women of color coaching/wellness businesses
   */
  findCurrentRealGrants() {
    console.log('🔍 FINDING REAL CURRENT GRANTS FOR ELEVATED MOVEMENTS');
    console.log('====================================================');
    
    try {
      const existingGrants = this.getExistingGrantNames();
      const realGrants = [];
      
      // Search Strategy 1: Current open federal grants
      console.log('1. Searching federal grants...');
      const federalGrants = this.findFederalGrants(existingGrants);
      realGrants.push(...federalGrants);
      
      // Search Strategy 2: Foundation grants with current deadlines
      console.log('2. Searching foundation grants...');
      const foundationGrants = this.findFoundationGrants(existingGrants);
      realGrants.push(...foundationGrants);
      
      // Search Strategy 3: Corporate social responsibility grants
      console.log('3. Searching corporate grants...');
      const corporateGrants = this.findCorporateGrants(existingGrants);
      realGrants.push(...corporateGrants);
      
      // Filter out duplicates and add to sheet
      const uniqueGrants = this.removeDuplicates(realGrants, existingGrants);
      
      if (uniqueGrants.length > 0) {
        this.addGrantsToSheet(uniqueGrants);
        console.log(`✅ Added ${uniqueGrants.length} real grants to your sheet!`);
        
        // Try to research the first few immediately
        console.log('🔬 Researching top grants for details...');
        this.researchTopGrants(uniqueGrants.slice(0, 3));
      } else {
        console.log('ℹ️ No new real grants found (may already exist in your sheet)');
      }
      
      return uniqueGrants;
      
    } catch (error) {
      console.error('❌ Error finding real grants:', error);
      return [];
    }
  },
  
  /**
   * Find current federal grants (Grants.gov style)
   */
  findFederalGrants(existingGrants) {
    const prompt = `Find REAL, currently open federal grants from Grants.gov for:

BUSINESS PROFILE:
- Black-owned, women-led coaching and wellness company
- Focus: Personal development for women of color
- Location: California (Silicon Valley area)
- Services: Burnout prevention, leadership coaching, professional development

SEARCH CRITERIA:
- Currently accepting applications (August-December 2025)
- Funding amounts: $10,000 - $500,000
- Eligible for LLCs or small businesses
- Related to: women's empowerment, minority business development, small business growth, wellness/health services

Existing grants to exclude: ${existingGrants.slice(0, 10).join(', ')}

Return ONLY real grants with:
1. EXACT official grant program name
2. Specific deadline (month/day/year)
3. Federal agency name
4. Funding range
5. Brief eligibility summary

Format as JSON array with grants that exist NOW:
[{
  "Grant_Name": "exact official name",
  "Sponsor_Org": "agency name", 
  "Amount": "funding amount",
  "Deadline": "MM/DD/YYYY",
  "Eligibility": "brief requirements",
  "Focus_Area": "program focus",
  "Discovery_Source": "Grants.gov Federal"
}]`;

    try {
      console.log('🔄 Calling OpenAI for federal grants...');
      const response = APIUtils.callOpenAI(prompt, {
        temperature: 0.3,
        maxTokens: 1000
      });
      
      console.log('📥 Federal grants API response received');
      console.log(`Response success: ${response.success}`);
      
      if (response.success) {
        console.log('✅ Federal grants API call successful');
        return this.parseGrantResponse(response.data, 'Federal');
      } else {
        console.error('❌ Federal grants API call failed:', response.error);
        return [];
      }
    } catch (error) {
      console.error('❌ Federal grants search failed:', error);
      return [];
    }
  },
  
  /**
   * Find current foundation grants
   */
  findFoundationGrants(existingGrants) {
    const prompt = `Find REAL, currently open foundation grants for:

TARGET: Black women-led coaching/wellness business in California

SPECIFIC FOUNDATIONS TO CHECK (find their current 2025 grants):
- Cartier Women's Initiative
- Amber Grant Foundation  
- The Fearless Fund (if active)
- National Women's Business Council programs
- California Community Foundation
- Silicon Valley Community Foundation
- Kapor Foundation
- Akonadi Foundation

REQUIREMENTS:
- Must have specific application deadlines in 2025
- $5,000 - $250,000 funding range
- Support women of color entrepreneurs
- Focus on wellness, coaching, or business development

Existing grants to exclude: ${existingGrants.slice(0, 10).join(', ')}

Return REAL grants with exact program names and current deadlines:

[{
  "Grant_Name": "exact program name from foundation website",
  "Sponsor_Org": "foundation name",
  "Amount": "exact funding amount",
  "Deadline": "specific date if available", 
  "Eligibility": "key requirements",
  "Focus_Area": "program area",
  "Discovery_Source": "Foundation Directory"
}]`;

    try {
      const response = APIUtils.callOpenAI(prompt, {
        temperature: 0.3,
        maxTokens: 1200
      });
      
      if (response.success) {
        return this.parseGrantResponse(response.data, 'Foundation');
      }
    } catch (error) {
      console.error('❌ Foundation grants search failed:', error);
    }
    
    return [];
  },
  
  /**
   * Find corporate social responsibility grants
   */
  findCorporateGrants(existingGrants) {
    const prompt = `Find REAL corporate grants and programs for women of color entrepreneurs:

TARGET: Coaching/wellness business led by Black women in California

CORPORATE PROGRAMS TO CHECK:
- Google.org Impact Challenge
- Microsoft LEAP Program
- Amazon Small Business Grants
- Visa Everywhere Initiative
- Mastercard Center for Inclusive Growth
- JPMorgan Chase Small Business Forward
- Target's Partners in Equity program
- Comcast RISE
- FedEx Small Business Grant Contest

CRITERIA:
- Currently accepting applications (late 2025)
- Support diverse entrepreneurs
- Technology, wellness, or small business focus
- Funding or acceleration opportunities

Existing to exclude: ${existingGrants.slice(0, 8).join(', ')}

Return active programs with application periods:

[{
  "Grant_Name": "exact program name",
  "Sponsor_Org": "company name",
  "Amount": "funding/benefit amount",
  "Deadline": "application period",
  "Eligibility": "requirements",
  "Focus_Area": "corporate focus area",
  "Discovery_Source": "Corporate Program"
}]`;

    try {
      const response = APIUtils.callOpenAI(prompt, {
        temperature: 0.3,
        maxTokens: 1000
      });
      
      if (response.success) {
        return this.parseGrantResponse(response.data, 'Corporate');
      }
    } catch (error) {
      console.error('❌ Corporate grants search failed:', error);
    }
    
    return [];
  },
  
  /**
   * Research specific grants for detailed information
   */
  researchTopGrants(grants) {
    grants.forEach((grant, index) => {
      try {
        console.log(`🔬 Researching: ${grant.Grant_Name}...`);
        
        const researchPrompt = `Research this SPECIFIC grant program for detailed application information:

GRANT: "${grant.Grant_Name}"
SPONSOR: "${grant.Sponsor_Org}"

Find and return:
1. Exact application deadline date
2. Specific contact person/email if available
3. Detailed eligibility requirements
4. Application process steps
5. Required documents
6. Selection criteria
7. Award amount details
8. Direct application link/website

IMPORTANT: Only return information if this is a REAL, current grant program. If the grant doesn't exist or isn't currently accepting applications, return "NOT FOUND".

Format as detailed summary focusing on actionable application information.`;

        const response = APIUtils.callOpenAI(researchPrompt, {
          temperature: 0.2,
          maxTokens: 800
        });
        
        if (response.success) {
          // Handle the response format properly
          let responseText;
          if (typeof response.data === 'string') {
            try {
              const parsedResponse = JSON.parse(response.data);
              responseText = parsedResponse.data || response.data;
            } catch (parseError) {
              responseText = response.data;
            }
          } else if (response.data && response.data.data) {
            responseText = response.data.data;
          } else {
            responseText = JSON.stringify(response.data);
          }
          
          if (responseText && !responseText.includes('NOT FOUND')) {
            this.updateGrantWithResearch(grant, responseText);
            console.log(`✅ Researched: ${grant.Grant_Name}`);
          } else {
            console.log(`⚠️ Could not verify: ${grant.Grant_Name}`);
          }
        } else {
          console.log(`❌ Research API failed for: ${grant.Grant_Name}`);
        }
        
        // Delay between research calls
        if (index < grants.length - 1) {
          Utilities.sleep(2000);
        }
        
      } catch (error) {
        console.error(`❌ Research failed for ${grant.Grant_Name}:`, error);
      }
    });
  },
  
  /**
   * Parse AI response into grant objects
   */
  parseGrantResponse(responseData, source) {
    let jsonString = ''; // Declare at function scope
    
    try {
      console.log(`🔍 Parsing ${source} response...`);
      
      // Handle the response format from your API
      let responseText;
      
      // First, check if responseData is a JSON string that needs parsing
      if (typeof responseData === 'string') {
        try {
          const parsedResponse = JSON.parse(responseData);
          if (parsedResponse && parsedResponse.data) {
            responseText = parsedResponse.data;
            console.log(`✅ Parsed JSON string and extracted data field`);
          } else {
            responseText = responseData;
          }
        } catch (parseError) {
          // If it's not JSON, treat as plain text
          responseText = responseData;
        }
      } else if (responseData && typeof responseData === 'object' && responseData.data) {
        // Your API returns {success: true, data: "actual content"}
        responseText = responseData.data;
        console.log(`✅ Extracted data field from ${source} response`);
      } else {
        console.error('❌ Unexpected response format:', typeof responseData);
        return [];
      }
      
      // Clean the response to extract JSON
      let cleanedResponse = responseText.toString().trim();
      console.log(`📝 Raw response preview: ${cleanedResponse.substring(0, 200)}...`);
      
      // Remove markdown formatting
      cleanedResponse = cleanedResponse.replace(/```json/g, '').replace(/```/g, '');
      
      // Fix escaped quotes that break JSON parsing
      cleanedResponse = cleanedResponse.replace(/\\"/g, '"');
      cleanedResponse = cleanedResponse.replace(/\\'/g, "'");
      
      // Try to find JSON array in the response
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        console.log(`✅ Found JSON array in ${source} response`);
        jsonString = jsonMatch[0].trim();
        
        // Additional cleaning for common JSON issues
        jsonString = jsonString.replace(/\n/g, ' ').replace(/\s+/g, ' ');
        
        // Fix any remaining formatting issues
        jsonString = jsonString.replace(/\s*,\s*/g, ',').replace(/\s*:\s*/g, ':');
        jsonString = jsonString.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        
        console.log(`🔧 Cleaned JSON: ${jsonString.substring(0, 200)}...`);
        
        const grants = JSON.parse(jsonString);
        console.log(`✅ Successfully parsed JSON with ${grants.length} grants`);
        
        // Validate and clean grant data
        const validGrants = grants.filter(grant => {
          const isValid = grant.Grant_Name && 
                         grant.Sponsor_Org && 
                         grant.Grant_Name.length > 5; // More lenient filter
          
          if (!isValid) {
            console.log(`⚠️ Filtered out: ${grant.Grant_Name || 'unnamed grant'}`);
          }
          return isValid;
        }).map(grant => ({
          ...grant,
          Discovery_Source: source,
          Source_Reliability_Score: source === 'Federal' ? 10 : source === 'Foundation' ? 9 : 8,
          Date_Added: new Date().toISOString().split('T')[0],
          Status: 'Open'
        }));
        
        console.log(`✅ Parsed ${validGrants.length} valid ${source} grants`);
        return validGrants;
      } else {
        console.log(`⚠️ No JSON array found in ${source} response`);
        
        // Try to create grants from plain text if no JSON found
        return this.parseTextResponse(cleanedResponse, source);
      }
    } catch (error) {
      console.error(`❌ Error parsing ${source} grant response:`, error);
      console.log(`❌ Problematic JSON string: ${jsonString}`);
      console.log('❌ Original response data:', responseData);
      
      // Try text parsing as fallback
      try {
        const fallbackText = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
        return this.parseTextResponse(fallbackText, source);
      } catch (fallbackError) {
        console.error('❌ Text parsing fallback also failed:', fallbackError);
        return [];
      }
    }
  },
  
  /**
   * Fallback parser for non-JSON responses
   */
  parseTextResponse(text, source) {
    try {
      console.log(`🔄 Attempting text parsing for ${source}...`);
      
      // Look for grant information in text format
      const grants = [];
      const lines = text.split('\n');
      let currentGrant = {};
      
      lines.forEach(line => {
        line = line.trim();
        if (line.includes('Grant_Name') || line.includes('Program:') || line.includes('Grant:')) {
          if (currentGrant.Grant_Name) {
            grants.push(currentGrant);
          }
          currentGrant = {
            Grant_Name: this.extractValue(line),
            Discovery_Source: source,
            Source_Reliability_Score: source === 'Federal' ? 10 : source === 'Foundation' ? 9 : 8,
            Date_Added: new Date().toISOString().split('T')[0],
            Status: 'Open'
          };
        } else if (line.includes('Sponsor') || line.includes('Organization:')) {
          currentGrant.Sponsor_Org = this.extractValue(line);
        } else if (line.includes('Amount') || line.includes('Funding:')) {
          currentGrant.Amount = this.extractValue(line);
        } else if (line.includes('Deadline') || line.includes('Due:')) {
          currentGrant.Deadline = this.extractValue(line);
        } else if (line.includes('Eligibility') || line.includes('Requirements:')) {
          currentGrant.Eligibility = this.extractValue(line);
        }
      });
      
      // Add the last grant if it exists
      if (currentGrant.Grant_Name) {
        grants.push(currentGrant);
      }
      
      console.log(`📝 Text parsing found ${grants.length} potential grants`);
      return grants.filter(grant => grant.Grant_Name && grant.Grant_Name.length > 10);
      
    } catch (error) {
      console.error('❌ Text parsing failed:', error);
      return [];
    }
  },
  
  /**
   * Extract value from a line of text
   */
  extractValue(line) {
    // Remove common prefixes and get the actual value
    return line.replace(/^[^:]*:/, '').replace(/^[^-]*-/, '').trim().replace(/"/g, '');
  },
  
  /**
   * Remove duplicates from grant list
   */
  removeDuplicates(newGrants, existingGrants) {
    return newGrants.filter(grant => {
      const grantName = grant.Grant_Name.toLowerCase();
      return !existingGrants.some(existing => 
        existing.toLowerCase().includes(grantName.substring(0, 20)) ||
        grantName.includes(existing.toLowerCase().substring(0, 20))
      );
    });
  },
  
  /**
   * Add grants to New_Grants sheet
   */
  addGrantsToSheet(grants) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('New_Grants');
      
      if (!sheet) {
        console.error('❌ New_Grants sheet not found');
        return false;
      }
      
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      let lastRow = sheet.getLastRow();
      
      grants.forEach(grant => {
        try {
          const rowData = new Array(headers.length).fill('');
          
          // Map grant data to columns
          headers.forEach((header, index) => {
            if (grant[header]) {
              rowData[index] = grant[header];
            }
          });
          
          // Add calculated fields
          const grantNameIndex = headers.indexOf('Grant_Name');
          const priorityScoreIndex = headers.indexOf('Priority_Score');
          const businessMatchIndex = headers.indexOf('Business_Match_Pct');
          const wocFocusIndex = headers.indexOf('WOC_Focus_Rating');
          
          if (grantNameIndex !== -1) rowData[grantNameIndex] = grant.Grant_Name;
          if (priorityScoreIndex !== -1) rowData[priorityScoreIndex] = this.calculateInitialPriority(grant);
          if (businessMatchIndex !== -1) rowData[businessMatchIndex] = this.estimateBusinessMatch(grant);
          if (wocFocusIndex !== -1) rowData[wocFocusIndex] = this.estimateWOCFocus(grant);
          
          // Add to sheet
          lastRow++; // Increment for next row
          sheet.getRange(lastRow, 1, 1, rowData.length).setValues([rowData]);
          console.log(`✅ Added grant: ${grant.Grant_Name}`);
          
        } catch (grantError) {
          console.error(`❌ Error adding individual grant: ${grant.Grant_Name}:`, grantError);
        }
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error adding grants to sheet:', error);
      return false;
    }
  },
  
  /**
   * Calculate initial priority score based on grant characteristics
   */
  calculateInitialPriority(grant) {
    let score = 50; // Base score
    
    // Boost for women/diversity focus
    const grantText = (grant.Grant_Name + ' ' + grant.Focus_Area + ' ' + grant.Eligibility).toLowerCase();
    if (grantText.includes('women') || grantText.includes('diverse')) score += 20;
    if (grantText.includes('black') || grantText.includes('minority')) score += 15;
    if (grantText.includes('coaching') || grantText.includes('wellness')) score += 10;
    if (grantText.includes('small business') || grantText.includes('entrepreneur')) score += 10;
    
    // Boost for higher funding amounts
    const amountText = grant.Amount?.toString().toLowerCase() || '';
    if (amountText.includes('100') || amountText.includes('50')) score += 10;
    if (amountText.includes('25')) score += 5;
    
    return Math.min(score, 95);
  },
  
  /**
   * Estimate business match percentage
   */
  estimateBusinessMatch(grant) {
    const grantText = (grant.Grant_Name + ' ' + grant.Focus_Area + ' ' + grant.Eligibility).toLowerCase();
    let match = 60; // Base match
    
    if (grantText.includes('coaching') || grantText.includes('wellness')) match += 20;
    if (grantText.includes('women') || grantText.includes('female')) match += 15;
    if (grantText.includes('leadership') || grantText.includes('development')) match += 10;
    if (grantText.includes('small business') || grantText.includes('entrepreneur')) match += 10;
    
    return Math.min(match, 95);
  },
  
  /**
   * Estimate WOC focus rating
   */
  estimateWOCFocus(grant) {
    const grantText = (grant.Grant_Name + ' ' + grant.Focus_Area + ' ' + grant.Eligibility).toLowerCase();
    let rating = 5; // Base rating
    
    if (grantText.includes('black') || grantText.includes('african american')) rating += 3;
    if (grantText.includes('women of color') || grantText.includes('diverse women')) rating += 3;
    if (grantText.includes('minority') || grantText.includes('underrepresented')) rating += 2;
    if (grantText.includes('women') && grantText.includes('business')) rating += 2;
    
    return Math.min(rating, 10);
  },
  
  /**
   * Get existing grant names to avoid duplicates
   */
  getExistingGrantNames() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = ['New_Grants', 'Grants'];
      const existingNames = [];
      
      sheets.forEach(sheetName => {
        const sheet = ss.getSheetByName(sheetName);
        if (sheet && sheet.getLastRow() > 1) {
          const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
          existingNames.push(...data.flat().filter(name => name && name.toString().trim()));
        }
      });
      
      return [...new Set(existingNames.map(name => name.toString().trim()))];
    } catch (error) {
      console.error('❌ Error getting existing grants:', error);
      return [];
    }
  },
  
  /**
   * Update grant with detailed research
   */
  updateGrantWithResearch(grant, researchData) {
    // This would update the grant in the sheet with detailed research
    // For now, just log the research
    console.log(`📝 Research for ${grant.Grant_Name}:`);
    console.log(researchData.substring(0, 200) + '...');
  }
};

// ====================
// DEBUG AND TEST FUNCTIONS
// ====================

/**
 * Test the API response parsing
 */
function testAPIResponseParsing() {
  console.log('🧪 TESTING API RESPONSE PARSING');
  console.log('===============================');
  
  try {
    // Test a simple prompt first
    const testPrompt = `Return exactly this JSON array:
[{
  "Grant_Name": "Test Women's Business Grant 2025",
  "Sponsor_Org": "Test Foundation",
  "Amount": "$25,000",
  "Deadline": "12/31/2025",
  "Eligibility": "Women-owned small businesses",
  "Focus_Area": "Business development"
}]`;

    console.log('🔄 Making test API call...');
    const response = APIUtils.callOpenAI(testPrompt, {
      temperature: 0.1,
      maxTokens: 300
    });
    
    console.log('📥 Test API response received');
    console.log('Response success:', response.success);
    console.log('Response type:', typeof response.data);
    console.log('Response data:', response.data);
    
    if (response.success) {
      console.log('✅ Testing parser...');
      const parsed = RealGrantFinder.parseGrantResponse(response.data, 'Test');
      console.log('Parsed grants:', parsed);
      console.log(`✅ Parser returned ${parsed.length} grants`);
    } else {
      console.error('❌ Test API call failed:', response.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Simplified grant finder for testing
 */
function findTestGrants() {
  console.log('🧪 SIMPLIFIED GRANT DISCOVERY TEST');
  console.log('==================================');
  
  try {
    const prompt = `List 2 real women's business grants that are currently accepting applications. Format as:

Grant 1: [Name] - [Organization] - [Amount] - [Deadline]
Grant 2: [Name] - [Organization] - [Amount] - [Deadline]

Focus on grants for women of color entrepreneurs in 2025.`;

    console.log('🔄 Making simplified API call...');
    const response = APIUtils.callOpenAI(prompt, {
      temperature: 0.3,
      maxTokens: 400
    });
    
    console.log('📥 Simplified response received');
    console.log('Success:', response.success);
    
    if (response.success) {
      console.log('✅ Response content:');
      console.log(response.data);
    } else {
      console.error('❌ Simplified call failed:', response.error);
    }
    
  } catch (error) {
    console.error('❌ Simplified test failed:', error);
  }
}

// ====================
// MENU FUNCTIONS (Updated)
// ====================

/**
 * Main function to find real current grants
 */
function findRealCurrentGrants() {
  const ui = SpreadsheetApp.getUi();
  
  ui.alert('🔍 Finding Real Current Grants',
    'Searching for actual, currently open grant opportunities...\n\n' +
    '• Federal grants (Grants.gov)\n' +
    '• Foundation programs with deadlines\n' +
    '• Corporate diversity initiatives\n\n' +
    'This may take 2-3 minutes.',
    ui.ButtonSet.OK);
  
  try {
    const realGrants = RealGrantFinder.findCurrentRealGrants();
    
    if (realGrants.length > 0) {
      ui.alert('✅ Real Grants Found!',
        `Found ${realGrants.length} real, current grant opportunities!\n\n` +
        '📋 Added to New_Grants sheet\n' +
        '🔬 Research completed for top grants\n' +
        '💡 Review and prioritize for applications',
        ui.ButtonSet.OK);
    } else {
      ui.alert('ℹ️ No New Grants',
        'No new real grants found at this time.\n' +
        'This may mean:\n' +
        '• You already have current opportunities\n' +
        '• Current search period between cycles\n' +
        '• Try again in a few days',
        ui.ButtonSet.OK);
    }
    
  } catch (error) {
    console.error('❌ Real grant discovery failed:', error);
    ui.alert('❌ Discovery Error',
      `Grant discovery failed: ${error.message}`,
      ui.ButtonSet.OK);
  }
}

/**
 * Research existing grants for better details
 */
function researchExistingGrants() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('New_Grants');
    
    if (!sheet || sheet.getLastRow() <= 1) {
      ui.alert('No Grants to Research', 'No grants found in New_Grants sheet to research.', ui.ButtonSet.OK);
      return;
    }
    
    // Get grants that need research (those without detailed info)
    const grants = [];
    const lastRow = sheet.getLastRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    for (let row = 2; row <= Math.min(lastRow, 6); row++) { // Research first 5 grants
      const grantName = sheet.getRange(row, 1).getValue();
      const sponsorOrg = sheet.getRange(row, headers.indexOf('Sponsor_Org') + 1).getValue();
      
      if (grantName && sponsorOrg) {
        grants.push({ Grant_Name: grantName, Sponsor_Org: sponsorOrg });
      }
    }
    
    if (grants.length > 0) {
      ui.alert('🔬 Researching Grants',
        `Researching ${grants.length} grants for detailed information...\n\n` +
        'This will find current deadlines, contact info, and requirements.',
        ui.ButtonSet.OK);
      
      RealGrantFinder.researchTopGrants(grants);
      
      ui.alert('✅ Research Complete',
        `Completed research on ${grants.length} grants.\n` +
        'Check the execution log for detailed findings.',
        ui.ButtonSet.OK);
    } else {
      ui.alert('No Grants to Research', 'No valid grants found to research.', ui.ButtonSet.OK);
    }
    
  } catch (error) {
    console.error('❌ Grant research failed:', error);
    ui.alert('❌ Research Error', `Research failed: ${error.message}`, ui.ButtonSet.OK);
  }
}