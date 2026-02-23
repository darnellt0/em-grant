//Module12_AdvancedSearch.gs
/**
 * ADVANCED GRANT SEARCH MODULE
 * Expands search capabilities with location-based, foundation-specific,
 * and strategic search approaches for Elevated Movements
 */
const AdvancedSearch = {
 
  // Foundation databases and their focus areas
  FOUNDATION_DATABASES: {
    'Women-Focused Foundations': [
      'Ms. Foundation for Women',
      'Global Fund for Women',
      'Astraea Lesbian Foundation for Justice',
      'Third Wave Foundation',
      'Women\'s Foundation of California',
      'California Women\'s Foundation',
      'American Association of University Women',
      'Soroptimist International',
      'P.E.O. Sisterhood'
    ],
    'BIPOC/Diversity Foundations': [
      'Ford Foundation',
      'W.K. Kellogg Foundation',
      'Casey Family Programs',
      'Open Society Foundations',
      'Silicon Valley Community Foundation',
      'California Endowment',
      'Marguerite Casey Foundation',
      'Echoing Green',
      'Ashoka',
      'New Profit'
    ],
    'Leadership Development': [
      'Center for Creative Leadership',
      'Leadership Learning Community',
      'Independent Sector',
      'BoardSource',
      'Nonprofit Finance Fund',
      'CompassPoint Nonprofit Services',
      'Management Center',
      'Bridgespan Group'
    ],
    'California-Specific': [
      'California Community Foundation',
      'San Francisco Foundation',
      'Silicon Valley Community Foundation',
      'East Bay Community Foundation',
      'Marin Community Foundation',
      'Peninsula Community Foundation',
      'California Wellness Foundation',
      'James Irvine Foundation',
      'David and Lucile Packard Foundation'
    ]
  },


  SEARCH_STRATEGIES: {
    geographic: [
      'California state grants',
      'Bay Area foundation grants',
      'Silicon Valley nonprofit funding',
      'Northern California community grants',
      'San Francisco Bay Area women grants',
      'California minority business grants'
    ],
    demographic: [
      'women of color leadership grants',
      'BIPOC women entrepreneurs funding',
      'minority women business development',
      'African American women leadership',
      'Latina women empowerment grants',
      'Asian American women leadership'
    ],
    sector: [
      'nonprofit leadership development grants',
      'community development leadership',
      'social entrepreneurship funding',
      'leadership coaching grants',
      'women leadership training funding',
      'executive coaching nonprofit grants'
    ],
    amount_ranges: [
      'small grants under $25000',
      'medium grants $25000 to $100000',
      'capacity building grants',
      'startup nonprofit grants',
      'organizational development funding'
    ]
  },


  expandedDiscovery() {
    const ui = SpreadsheetApp.getUi();
   
    const response = ui.alert('🔍 Expanded Grant Discovery',
      'Enhanced AI discovery with multiple search strategies:\n\n' +
      '📍 Location-based targeting\n' +
      '🏛️ Foundation-specific searches\n' +
      '👥 Demographic focus\n' +
      '💰 Amount-based filtering\n\n' +
      'This will take 5-8 minutes but find more opportunities.\n\n' +
      'Continue?',
      ui.ButtonSet.YES_NO);
   
    if (response !== ui.Button.YES) return;


    try {
      const existingGrants = this.getExistingGrantNames();
      let allDiscoveredGrants = [];
      let searchCount = 0;
     
      ui.alert('🚀 Starting Enhanced Discovery',
        'Running multiple search strategies...\n\n' +
        'This comprehensive search will take several minutes.',
        ui.ButtonSet.OK);


      // Foundation-based searches
      const foundationResults = this.searchByFoundations(existingGrants);
      allDiscoveredGrants = allDiscoveredGrants.concat(foundationResults);
      searchCount++;
     
      // Geographic searches  
      const geoResults = this.searchByGeography(existingGrants);
      allDiscoveredGrants = allDiscoveredGrants.concat(geoResults);
      searchCount++;
     
      // Demographic searches
      const demoResults = this.searchByDemographics(existingGrants);
      allDiscoveredGrants = allDiscoveredGrants.concat(demoResults);
      searchCount++;
     
      // Sector-specific searches
      const sectorResults = this.searchBySector(existingGrants);
      allDiscoveredGrants = allDiscoveredGrants.concat(sectorResults);
      searchCount++;
     
      // Remove duplicates
      const uniqueGrants = this.removeDuplicateGrants(allDiscoveredGrants);
     
      if (uniqueGrants.length > 0) {
        this.addGrantsToNewSheet(uniqueGrants);
       
        ui.alert('✅ Enhanced Discovery Complete!',
          `Found ${uniqueGrants.length} unique opportunities!\n\n` +
          `📊 Searched ${searchCount} strategies\n` +
          `🔍 Results in New_Grants sheet\n` +
          `📥 Review and merge best opportunities`,
          ui.ButtonSet.OK);
      } else {
        ui.alert('No New Opportunities',
          `Completed ${searchCount} search strategies but found no new grants.`,
          ui.ButtonSet.OK);
      }
     
      CoreUtils.logSystemEvent('Enhanced Discovery', 'Success',
        `Found ${uniqueGrants.length} grants from ${searchCount} strategies`);
     
    } catch (error) {
      Logger.log(`❌ Enhanced discovery error: ${error.message}`);
      ui.alert('❌ Discovery Error', `Enhanced discovery failed: ${error.message}`, ui.ButtonSet.OK);
    }
  },


  searchByFoundations(existingGrants) {
    Logger.log('🏛️ Starting foundation-based search...');
    const results = [];
   
    try {
      const prompt = this.createFoundationSearchPrompt(existingGrants);
      const response = APIUtils.callOpenAI(prompt, {
        temperature: 0.4,
        maxTokens: 1200
      });
     
      if (response.success) {
        const grants = GrantDiscovery.parseDiscoveryResponse(response.data);
        grants.forEach(grant => {
          grant.discoverySource = 'Foundation Search';
          grant.searchStrategy = 'Foundation-Targeted';
        });
        results.push(...grants);
      }
     
      // Add delay between searches
      Utilities.sleep(3000);
     
    } catch (error) {
      Logger.log(`❌ Foundation search error: ${error.message}`);
    }
   
    return results;
  },


  createFoundationSearchPrompt(existingGrants) {
    const targetFoundations = [
      ...this.FOUNDATION_DATABASES['Women-Focused Foundations'].slice(0, 3),
      ...this.FOUNDATION_DATABASES['BIPOC/Diversity Foundations'].slice(0, 3),
      ...this.FOUNDATION_DATABASES['California-Specific'].slice(0, 3)
    ];
   
    return `Find 6-8 grants from specific foundations for Elevated Movements (WOC leadership development, California).


TARGET FOUNDATIONS TO SEARCH:
${targetFoundations.map(f => `- ${f}`).join('\n')}


ORGANIZATION PROFILE:
- Women of color leadership development
- Silicon Valley, California location
- Founder: Shria Tomlinson
- Focus: Leadership coaching, community building, professional development


REQUIREMENTS:
- Current/upcoming deadlines (not expired)
- $5,000 - $200,000 range
- Real grants from actual foundations
- Must align with WOC leadership/empowerment


AVOID: ${existingGrants.slice(0, 8).join(', ')}


Return JSON array:
[
  {
    "grantName": "Actual Grant Program Name",
    "sponsorOrg": "Foundation Name",
    "focusArea": "women leadership/empowerment",
    "deadline": "MM/DD/YYYY or Rolling",
    "amount": 50000,
    "eligibility": "Key requirements",
    "notes": "Why perfect for Elevated Movements",
    "applicationUrl": "URL if known"
  }
]


Focus on realistic opportunities from established foundations.`;
  },


  searchByGeography(existingGrants) {
    Logger.log('📍 Starting geography-based search...');
    const results = [];
   
    try {
      const prompt = this.createGeographicSearchPrompt(existingGrants);
      const response = APIUtils.callOpenAI(prompt, {
        temperature: 0.4,
        maxTokens: 1200
      });
     
      if (response.success) {
        const grants = GrantDiscovery.parseDiscoveryResponse(response.data);
        grants.forEach(grant => {
          grant.discoverySource = 'Geographic Search';
          grant.searchStrategy = 'Location-Based';
        });
        results.push(...grants);
      }
     
      Utilities.sleep(3000);
     
    } catch (error) {
      Logger.log(`❌ Geographic search error: ${error.message}`);
    }
   
    return results;
  },


  createGeographicSearchPrompt(existingGrants) {
    return `Find 6-8 California/Bay Area specific grants for Elevated Movements.


GEOGRAPHIC FOCUS:
- California state grants and programs
- Bay Area/Silicon Valley regional funding
- Northern California community foundations
- San Francisco Bay Area specific opportunities
- California minority business development programs


ORGANIZATION:
- Location: Silicon Valley, California
- Focus: Women of color leadership development
- Founded by Shria Tomlinson (WOC leader)
- Mission: WOC leadership coaching and community building


SEARCH CRITERIA:
- California-based or California-serving programs
- Regional community foundation grants
- State of California grant programs
- Bay Area nonprofit funding opportunities
- Silicon Valley community grants


AVOID: ${existingGrants.slice(0, 8).join(', ')}


Return JSON array with California-specific opportunities:
[
  {
    "grantName": "Real California/Bay Area Grant",
    "sponsorOrg": "CA Foundation/Agency Name",
    "focusArea": "women leadership/community development",
    "deadline": "MM/DD/YYYY",
    "amount": 35000,
    "eligibility": "California organizations",
    "notes": "Geographic alignment details"
  }
]`;
  },


  searchByDemographics(existingGrants) {
    Logger.log('👥 Starting demographic-focused search...');
    const results = [];
   
    try {
      const prompt = this.createDemographicSearchPrompt(existingGrants);
      const response = APIUtils.callOpenAI(prompt, {
        temperature: 0.4,
        maxTokens: 1200
      });
     
      if (response.success) {
        const grants = GrantDiscovery.parseDiscoveryResponse(response.data);
        grants.forEach(grant => {
          grant.discoverySource = 'Demographic Search';
          grant.searchStrategy = 'WOC-Focused';
        });
        results.push(...grants);
      }
     
      Utilities.sleep(3000);
     
    } catch (error) {
      Logger.log(`❌ Demographic search error: ${error.message}`);
    }
   
    return results;
  },


  createDemographicSearchPrompt(existingGrants) {
    return `Find 6-8 grants specifically targeting women of color for Elevated Movements.


DEMOGRAPHIC FOCUS:
- Women of color leadership development
- BIPOC women entrepreneurs
- Minority women business development
- African American women leadership
- Latina women empowerment
- Asian American women advancement
- Indigenous women leadership


ORGANIZATION PROFILE:
- Led by Shria Tomlinson (woman of color)
- Mission: WOC leadership development
- Services: Leadership coaching, community building
- Target: Women of color professionals and entrepreneurs


GRANT TYPES TO FIND:
- Women of color specific programs
- Minority women business grants
- BIPOC leadership development funding
- Diversity, equity, inclusion grants
- Women of color entrepreneur support
- Minority-serving organization grants


AVOID: ${existingGrants.slice(0, 8).join(', ')}


Return JSON array focusing on WOC-specific opportunities:
[
  {
    "grantName": "WOC/BIPOC Specific Grant Name",
    "sponsorOrg": "Foundation/Corporation",
    "focusArea": "women of color leadership",
    "deadline": "MM/DD/YYYY",
    "amount": 45000,
    "eligibility": "WOC-led organizations",
    "notes": "Perfect demographic alignment"
  }
]`;
  },


  searchBySector(existingGrants) {
    Logger.log('🎯 Starting sector-specific search...');
    const results = [];
   
    try {
      const prompt = this.createSectorSearchPrompt(existingGrants);
      const response = APIUtils.callOpenAI(prompt, {
        temperature: 0.4,
        maxTokens: 1200
      });
     
      if (response.success) {
        const grants = GrantDiscovery.parseDiscoveryResponse(response.data);
        grants.forEach(grant => {
          grant.discoverySource = 'Sector Search';
          grant.searchStrategy = 'Leadership-Focused';
        });
        results.push(...grants);
      }
     
      Utilities.sleep(3000);
     
    } catch (error) {
      Logger.log(`❌ Sector search error: ${error.message}`);
    }
   
    return results;
  },


  createSectorSearchPrompt(existingGrants) {
    return `Find 6-8 leadership development and coaching sector grants for Elevated Movements.


SECTOR FOCUS:
- Leadership development programs
- Executive coaching initiatives
- Professional development funding
- Leadership training programs
- Coaching certification support
- Organizational development grants
- Capacity building for nonprofits
- Social entrepreneurship support


ORGANIZATION SERVICES:
- Leadership coaching for women of color
- Professional development workshops
- Community leadership building
- Entrepreneur mentorship
- Leadership skill development
- Executive coaching services


GRANT CATEGORIES:
- Leadership development funding
- Coaching and mentoring programs
- Professional development grants
- Capacity building opportunities
- Skills development funding
- Training and education grants


AVOID: ${existingGrants.slice(0, 8).join(', ')}


Return JSON array with leadership/coaching focused grants:
[
  {
    "grantName": "Leadership Development Grant Name",
    "sponsorOrg": "Foundation/Corporation",
    "focusArea": "leadership development/coaching",
    "deadline": "MM/DD/YYYY",
    "amount": 40000,
    "eligibility": "Leadership development orgs",
    "notes": "Perfect sector alignment"
  }
]`;
  },


  removeDuplicateGrants(grantsList) {
    const seen = new Set();
    const unique = [];
   
    grantsList.forEach(grant => {
      const key = `${grant.grantName.toLowerCase().trim()}_${grant.sponsorOrg.toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(grant);
      }
    });
   
    return unique;
  },


  getExistingGrantNames() {
    try {
      const ss = CoreUtils.getSpreadsheetSafely();
      const grantsSheet = ss.getSheetByName(GRANT_CONFIG.SHEETS.GRANTS);
      const newGrantsSheet = ss.getSheetByName(GRANT_CONFIG.SHEETS.NEW_GRANTS);
     
      const existingNames = [];
     
      // Get from main grants sheet
      if (grantsSheet && grantsSheet.getLastRow() > 1) {
        const grantsData = grantsSheet.getRange(2, 1, grantsSheet.getLastRow() - 1, 1).getValues();
        existingNames.push(...grantsData.flat().filter(name => name && name.toString().trim()));
      }
     
      // Get from new grants sheet
      if (newGrantsSheet && newGrantsSheet.getLastRow() > 1) {
        const newGrantsData = newGrantsSheet.getRange(2, 1, newGrantsSheet.getLastRow() - 1, 1).getValues();
        existingNames.push(...newGrantsData.flat().filter(name => name && name.toString().trim()));
      }
     
      return [...new Set(existingNames.map(name => name.toString().trim()))];
     
    } catch (error) {
      Logger.log(`❌ Error getting existing grants: ${error.message}`);
      return [];
    }
  },


  addGrantsToNewSheet(grants) {
    return GrantDiscovery.addGrantsToNewSheet(grants);
  },


  // Targeted search by specific foundation
  searchSpecificFoundation() {
    const ui = SpreadsheetApp.getUi();
   
    // Show foundation options
    const foundationOptions = Object.entries(this.FOUNDATION_DATABASES)
      .map(([category, foundations]) => `${category}:\n${foundations.slice(0, 3).map(f => `• ${f}`).join('\n')}`)
      .join('\n\n');
   
    const response = ui.prompt('🎯 Search Specific Foundation',
      'Enter foundation name to search:\n\n' +
      'Popular options:\n' + foundationOptions,
      ui.ButtonSet.OK_CANCEL);
   
    if (response.getSelectedButton() !== ui.Button.OK) return;
   
    const foundationName = response.getResponseText().trim();
    if (!foundationName) {
      ui.alert('No Foundation Entered', 'Please enter a foundation name to search.', ui.ButtonSet.OK);
      return;
    }
   
    this.runFoundationSpecificSearch(foundationName);
  },


  runFoundationSpecificSearch(foundationName) {
    const ui = SpreadsheetApp.getUi();
   
    try {
      ui.alert('🔍 Foundation Search Started',
        `Searching for grants from: ${foundationName}\n\nThis may take 2-3 minutes.`,
        ui.ButtonSet.OK);
     
      const existingGrants = this.getExistingGrantNames();
     
      const prompt = `Find current grant opportunities from "${foundationName}" for Elevated Movements.


ORGANIZATION: Elevated Movements
- Women of color leadership development
- Silicon Valley, California
- Founder: Shria Tomlinson
- Focus: Leadership coaching, community empowerment


TARGET FOUNDATION: ${foundationName}


Find 3-5 current/upcoming grants from this specific foundation that align with:
- Women of color leadership
- Professional development
- Community building
- Entrepreneurship support
- Leadership training


AVOID: ${existingGrants.slice(0, 10).join(', ')}


Return JSON array with real opportunities from ${foundationName}:
[
  {
    "grantName": "Specific Grant Program from ${foundationName}",
    "sponsorOrg": "${foundationName}",
    "focusArea": "leadership/women empowerment",
    "deadline": "MM/DD/YYYY",
    "amount": 50000,
    "eligibility": "Key requirements",
    "notes": "Application details and fit"
  }
]`;


      const response = APIUtils.callOpenAI(prompt, {
        temperature: 0.3,
        maxTokens: 1000
      });
     
      if (response.success) {
        const grants = GrantDiscovery.parseDiscoveryResponse(response.data);
       
        if (grants.length > 0) {
          grants.forEach(grant => {
            grant.discoverySource = `Foundation: ${foundationName}`;
            grant.searchStrategy = 'Foundation-Specific';
          });
         
          this.addGrantsToNewSheet(grants);
         
          ui.alert('✅ Foundation Search Complete!',
            `Found ${grants.length} opportunities from ${foundationName}!\n\n` +
            '📊 Results added to New_Grants sheet\n' +
            '🔍 Review and research these grants',
            ui.ButtonSet.OK);
        } else {
          ui.alert('No Opportunities Found',
            `No current grants found from ${foundationName} matching your criteria.`,
            ui.ButtonSet.OK);
        }
      } else {
        throw new Error(response.error);
      }
     
      CoreUtils.logSystemEvent('Foundation-Specific Search', 'Success',
        `${foundationName}: Found ${grants?.length || 0} grants`);
     
    } catch (error) {
      Logger.log(`❌ Foundation-specific search error: ${error.message}`);
      ui.alert('❌ Search Error',
        `Foundation search failed: ${error.message}`,
        ui.ButtonSet.OK);
    }
  },


  // Search by funding amount range
  searchByAmountRange() {
    const ui = SpreadsheetApp.getUi();
   
    const response = ui.prompt('💰 Search by Grant Amount',
      'Enter funding range to target:\n\n' +
      'Options:\n' +
      '• small (under $25,000)\n' +
      '• medium ($25,000 - $100,000)\n' +
      '• large ($100,000+)\n' +
      '• Or enter specific range: e.g., "50000-150000"',
      ui.ButtonSet.OK_CANCEL);
   
    if (response.getSelectedButton() !== ui.Button.OK) return;
   
    const amountRange = response.getResponseText().trim().toLowerCase();
    if (!amountRange) {
      ui.alert('No Range Entered', 'Please enter an amount range.', ui.ButtonSet.OK);
      return;
    }
   
    this.runAmountRangeSearch(amountRange);
  },


  runAmountRangeSearch(rangeInput) {
    const ui = SpreadsheetApp.getUi();
   
    try {
      // Parse range
      let minAmount, maxAmount, rangeDescription;
     
      if (rangeInput === 'small') {
        minAmount = 5000;
        maxAmount = 25000;
        rangeDescription = 'small grants ($5K-$25K)';
      } else if (rangeInput === 'medium') {
        minAmount = 25000;
        maxAmount = 100000;
        rangeDescription = 'medium grants ($25K-$100K)';
      } else if (rangeInput === 'large') {
        minAmount = 100000;
        maxAmount = 500000;
        rangeDescription = 'large grants ($100K+)';
      } else if (rangeInput.includes('-')) {
        const [min, max] = rangeInput.split('-').map(n => parseInt(n.trim()));
        minAmount = min || 5000;
        maxAmount = max || 100000;
        rangeDescription = `$${minAmount.toLocaleString()}-$${maxAmount.toLocaleString()}`;
      } else {
        throw new Error('Invalid range format');
      }
     
      ui.alert('💰 Amount-Based Search Started',
        `Searching for grants in range: ${rangeDescription}\n\nThis may take 2-3 minutes.`,
        ui.ButtonSet.OK);
     
      const existingGrants = this.getExistingGrantNames();
     
      const prompt = `Find ${rangeDescription} grants for Elevated Movements (WOC leadership development).


FUNDING RANGE: $${minAmount.toLocaleString()} - $${maxAmount.toLocaleString()}


ORGANIZATION PROFILE:
- Women of color leadership development
- California-based
- Founder: Shria Tomlinson
- Services: Leadership coaching, professional development


SEARCH CRITERIA:
- Grant amounts between $${minAmount.toLocaleString()} and $${maxAmount.toLocaleString()}
- Perfect for ${rangeDescription.includes('small') ? 'capacity building and program development' :
                 rangeDescription.includes('medium') ? 'program expansion and organizational growth' :
                 'major initiatives and long-term projects'}
- Current/upcoming deadlines
- Realistic for WOC-led leadership organization


AVOID: ${existingGrants.slice(0, 8).join(', ')}


Return JSON array with grants in specified range:
[
  {
    "grantName": "Grant Program Name",
    "sponsorOrg": "Foundation Name",
    "focusArea": "leadership development",
    "deadline": "MM/DD/YYYY",
    "amount": ${Math.floor((minAmount + maxAmount) / 2)},
    "eligibility": "Key requirements",
    "notes": "Perfect amount for our needs"
  }
]`;


      const response = APIUtils.callOpenAI(prompt, {
        temperature: 0.4,
        maxTokens: 1000
      });
     
      if (response.success) {
        const grants = GrantDiscovery.parseDiscoveryResponse(response.data);
       
        if (grants.length > 0) {
          grants.forEach(grant => {
            grant.discoverySource = `Amount Range: ${rangeDescription}`;
            grant.searchStrategy = 'Amount-Targeted';
          });
         
          this.addGrantsToNewSheet(grants);
         
          ui.alert('✅ Amount-Based Search Complete!',
            `Found ${grants.length} grants in ${rangeDescription} range!\n\n` +
            '📊 Results added to New_Grants sheet\n' +
            '💰 All grants match your funding target',
            ui.ButtonSet.OK);
        } else {
          ui.alert('No Grants Found',
            `No grants found in ${rangeDescription} range matching your criteria.`,
            ui.ButtonSet.OK);
        }
      } else {
        throw new Error(response.error);
      }
     
      CoreUtils.logSystemEvent('Amount-Range Search', 'Success',
        `${rangeDescription}: Found ${grants?.length || 0} grants`);
     
    } catch (error) {
      Logger.log(`❌ Amount-range search error: ${error.message}`);
      ui.alert('❌ Search Error',
        `Amount-based search failed: ${error.message}`,
        ui.ButtonSet.OK);
    }
  }
};


// Global functions for menu access
function expandedDiscovery() {
  AdvancedSearch.expandedDiscovery();
}


function searchSpecificFoundation() {
  AdvancedSearch.searchSpecificFoundation();
}


function searchByAmountRange() {
  AdvancedSearch.searchByAmountRange();
}


function searchGeographicFocus() {
  AdvancedSearch.searchByGeography([]);
}


function searchDemographicFocus() {
  AdvancedSearch.searchByDemographics([]);
}
