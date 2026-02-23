// ============================================
// Module6_GrantDiscovery.gs  (Integrated with Verified Debug Fixes)
// - Discovery: JSON-forced + hardened parsing + DEADLINE FILTERING
// - Research: CHUNKED with cursor (batch size = 12)
// - Only marks Research_Complete if contact/app link exists
// - Fixed column mapping for Days_Left in column B structure
// - VERIFIED: Proper date parsing and validation logic with debug
// ============================================

const GrantDiscovery = {
  // ====== DISCOVERY ======
  autoDiscoverGrants() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'AI Grant Discovery',
      'Starting AI-powered discovery for Elevated Movements...\n\n' +
        '🎯 Focus: Women of color leadership\n' +
        '📍 Location: Silicon Valley/California\n' +
        '⏱️ Estimated time: 2–3 minutes\n\n' +
        'Continue?',
      ui.ButtonSet.YES_NO
    );
    if (response !== ui.Button.YES) return;

    let discovered = [];
    let validGrants = [];

    try {
      const existing = this.getExistingGrantNames();
      const prompt = this.createElevatedMovementsDiscoveryPrompt(existing);

      // Force JSON output for reliability
      const result = APIUtils.callOpenAI(prompt, { temperature: 0.3, maxTokens: 1500, forceJson: true });
      Logger.log('🧪 Discovery result type: ' + (typeof result?.data));

      if (result && result.success) {
        discovered = this.parseDiscoveryResponse(result.data);

        if (discovered.length > 0) {
          // ✅ FILTER OUT EXPIRED GRANTS BEFORE ADDING
          validGrants = this.filterValidGrants(discovered);
          
          if (validGrants.length > 0) {
            const added = this.addGrantsToNewSheet(validGrants);
            ui.alert(
              '✅ Discovery Complete!',
              `Found ${discovered.length} potential grants!\n` +
              `Filtered to ${validGrants.length} current opportunities.\n` +
              `Added ${added} new grants to review.\n\n` +
              '📊 Results in New_Grants\n' +
              '🔍 Review & research\n' +
              '📥 Merge best to main',
              ui.ButtonSet.OK
            );
          } else {
            ui.alert('All Grants Expired', 
              `Found ${discovered.length} grants but all had expired deadlines.\n\n` +
              'AI discovery will retry with better date filtering.',
              ui.ButtonSet.OK);
          }
        } else {
          ui.alert('No New Opportunities', 'AI discovery completed but found no new grants.', ui.ButtonSet.OK);
        }
      } else {
        throw new Error(result?.error || 'Unknown API error');
      }

      CoreUtils.logSystemEvent('AI Discovery', 'Success', `Found ${discovered.length} grants, ${validGrants.length} valid`);
    } catch (error) {
      Logger.log('❌ AI discovery error: ' + error.message);
      CoreUtils.logSystemEvent('AI Discovery', 'Error', error.message);
      ui.alert('❌ Discovery Error', 'AI discovery failed: ' + error.message, ui.ButtonSet.OK);
    }
  },

  // ✅ UPDATED PROMPT WITH BETTER DATE FILTERING
  createElevatedMovementsDiscoveryPrompt(existingGrants) {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy');
    const avoid = (existingGrants || []).slice(0, 12).join(', ');
    
    return `Return ONLY a JSON object (no prose, no markdown) in this EXACT shape:
{
  "items": [
    {
      "grantName": "Exact Program Name",
      "sponsorOrg": "Specific Foundation/Agency",
      "focusArea": "women of color leadership/community development",
      "deadline": "MM/DD/YYYY or Rolling",
      "amount": 25000,
      "eligibility": "Brief eligibility requirements",
      "notes": "Why this fits Elevated Movements"
    }
  ]
}

TASK:
Find 5–7 REAL, SPECIFIC grant opportunities with exact program names for Elevated Movements (a women of color leadership development organization in Silicon Valley, California).

CRITICAL DEADLINE REQUIREMENTS:
- Deadlines must be AFTER ${currentMonth}/${currentYear} (no expired grants!)
- Only include grants with deadlines in ${currentYear + 1} or later, OR rolling/ongoing opportunities
- Verify deadlines are realistic and current
- Rolling/ongoing programs are EXCELLENT

CONTEXT:
- Founder: Shria Tomlinson
- Mission: Women of color leadership development and community impact
- Work: Leadership coaching, community building, entrepreneurship support

TARGET FUNDER TYPES:
- Women's foundations (Women's Foundation of California, Ms. Foundation, etc.)
- Corporate foundations (Google.org current programs, Wells Fargo Foundation)
- California community foundations (e.g., Silicon Valley Community Foundation)
- Federal agencies (SBA current programs, Dept. of Labor)
- Private foundations focused on equity/leadership
- Bay Area regional foundations

REQUIREMENTS:
- Use EXACT program names from real funders (no generic names)
- Include real foundation/agency names
- Current or upcoming cycles (after ${ts})
- Amounts $5,000–$250,000
- Focus on verifiable, established programs
- NO 2023 or expired 2024 deadlines

AVOID (already tracked):
${avoid}

Focus on current programs with 2025+ deadlines or rolling applications.`;
  },

  // ✅ VERIFIED: DEADLINE VALIDATION FUNCTIONS WITH DEBUG
  /**
   * Filter out expired grants and validate deadlines - VERIFIED VERSION
   */
  filterValidGrants(grants) {
    const today = new Date();
    const validGrants = [];
    
    // Set time to start of day for fair comparison
    today.setHours(0, 0, 0, 0);
    
    Logger.log(`📅 Today's date for comparison: ${today.toDateString()}`);
    
    grants.forEach(grant => {
      // Handle different deadline formats
      const deadline = grant.deadline || grant.deadlineEst || '';
      
      // Keep rolling/ongoing grants
      if (this.isRollingGrant(deadline)) {
        grant.deadline = 'Rolling';
        grant.daysLeft = 'Rolling';
        validGrants.push(grant);
        Logger.log(`✅ Keeping rolling grant: ${grant.grantName}`);
        return;
      }
      
      // Parse and validate specific dates
      const parsedDate = this.parseGrantDeadline(deadline);
      
      if (parsedDate) {
        // Set parsed date to end of day for fair comparison
        parsedDate.setHours(23, 59, 59, 999);
        
        Logger.log(`🔍 Comparing: ${grant.grantName}`);
        Logger.log(`   Parsed: ${parsedDate.toDateString()} (${parsedDate.getTime()})`);
        Logger.log(`   Today:  ${today.toDateString()} (${today.getTime()})`);
        Logger.log(`   Result: ${parsedDate >= today ? 'FUTURE/CURRENT' : 'EXPIRED'}`);
        
        if (parsedDate >= today) {
          // ✅ VALID FUTURE/CURRENT DEADLINE - KEEP IT
          grant.deadline = DateUtils.formatDateForSheet(parsedDate);
          grant.daysLeft = DateUtils.calculateDaysLeft(parsedDate);
          validGrants.push(grant);
          Logger.log(`✅ Keeping valid grant: ${grant.grantName} (deadline: ${grant.deadline})`);
        } else {
          // ❌ EXPIRED - SKIP THIS GRANT
          Logger.log(`⏰ Skipping expired grant: ${grant.grantName} (deadline: ${deadline})`);
        }
      } else {
        // ⚠️ UNCLEAR DEADLINE - INCLUDE FOR MANUAL REVIEW
        grant.deadline = deadline || 'TBD';
        grant.daysLeft = 'TBD';
        grant.notes = (grant.notes || '') + ' [VERIFY DEADLINE]';
        validGrants.push(grant);
        Logger.log(`⚠️ Unclear deadline for: ${grant.grantName} (deadline: ${deadline}) - including for review`);
      }
    });
    
    Logger.log(`📅 Filtered ${grants.length} grants to ${validGrants.length} valid opportunities`);
    return validGrants;
  },

  /**
   * Check if grant has rolling/ongoing deadline
   */
  isRollingGrant(deadline) {
    if (!deadline) return false;
    
    const rollingTerms = [
      'rolling', 'ongoing', 'continuous', 'quarterly', 
      'monthly', 'annual', 'year-round', 'open'
    ];
    
    const deadlineText = deadline.toString().toLowerCase();
    return rollingTerms.some(term => deadlineText.includes(term));
  },

  /**
   * Parse various deadline formats - VERIFIED VERSION
   */
  parseGrantDeadline(deadline) {
    if (!deadline) return null;
    
    const deadlineStr = deadline.toString().trim();
    
    // Try different date formats
    const formats = [
      {
        regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // MM/DD/YYYY
        name: 'MM/DD/YYYY',
        parser: (match) => ({
          month: parseInt(match[1]) - 1, // JS months are 0-based
          day: parseInt(match[2]),
          year: parseInt(match[3])
        })
      },
      {
        regex: /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
        name: 'YYYY-MM-DD',
        parser: (match) => ({
          year: parseInt(match[1]),
          month: parseInt(match[2]) - 1, // JS months are 0-based
          day: parseInt(match[3])
        })
      },
      {
        regex: /(\d{1,2})-(\d{1,2})-(\d{4})/,   // MM-DD-YYYY
        name: 'MM-DD-YYYY',
        parser: (match) => ({
          month: parseInt(match[1]) - 1, // JS months are 0-based
          day: parseInt(match[2]),
          year: parseInt(match[3])
        })
      }
    ];
    
    for (const format of formats) {
      const match = deadlineStr.match(format.regex);
      if (match) {
        const { year, month, day } = format.parser(match);
        
        // Validate date components
        if (year >= 2020 && year <= 2030 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          const parsedDate = new Date(year, month, day);
          
          // Verify the date was created correctly (handles invalid dates like Feb 30)
          if (parsedDate.getFullYear() === year && 
              parsedDate.getMonth() === month && 
              parsedDate.getDate() === day) {
            return parsedDate;
          }
        }
      }
    }
    
    // Try to parse with JavaScript Date constructor as fallback
    try {
      const parsed = new Date(deadlineStr);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2020) {
        return parsed;
      }
    } catch (error) {
      // Ignore parsing errors
    }
    
    return null;
  },

  // Accepts string, object-with-items, or raw OpenAI JSON; returns array of normalized grants
  parseDiscoveryResponse(responseInput) {
    try {
      let raw = responseInput;

      // Unwrap our standard result shape {success, data}
      if (raw && typeof raw === 'object' && Object.prototype.hasOwnProperty.call(raw, 'data')) {
        raw = raw.data;
      }

      // If it's a raw OpenAI response object, try to extract content
      if (raw && typeof raw === 'object' && raw.choices) {
        const content = raw.choices && raw.choices[0] && raw.choices[0].message
          ? raw.choices[0].message.content
          : null;
        raw = (typeof content === 'string') ? content : JSON.stringify(raw);
      }

      // Normalize to string and strip code fences if any
      let jsonText = String(raw || '').trim().replace(/```json/gi, '').replace(/```/g, '').trim();

      // Try parse as-is (object form expected when forceJson is on)
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (e1) {
        // If model returned prose + JSON array, slice the first [...] block
        const a = jsonText.indexOf('['), b = jsonText.lastIndexOf(']');
        if (a !== -1 && b > a) parsed = JSON.parse(jsonText.slice(a, b + 1));
        else throw e1;
      }

      // Normalize to array of items
      let items = [];
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed && Array.isArray(parsed.items)) {
        items = parsed.items;
      } else if (parsed) {
        items = [parsed];
      }

      // Map + normalize
      return items.map(function(g) {
        return {
          grantName: CoreUtils.cleanString(g.grantName || g.name || 'Unknown Grant'),
          sponsorOrg: CoreUtils.cleanString(g.sponsorOrg || g.sponsor || g.funder || 'TBD'),
          focusArea: CoreUtils.cleanString(g.focusArea || g.focus || 'Community Development'),
          deadline: CoreUtils.cleanString(g.deadline || 'TBD'),
          amount: parseInt(g.amount, 10) || null,
          eligibility: CoreUtils.cleanString(g.eligibility || ''),
          notes: CoreUtils.cleanString(g.notes || 'AI Discovery'),
          discoverySource: 'AI Discovery',
          discoveryDate: new Date()
        };
      });
    } catch (err) {
      Logger.log('❌ Parse discovery response error: ' + err.message);
      return [];
    }
  },

  getExistingGrantNames() {
    try {
      const ss = CoreUtils.getSpreadsheetSafely();
      const sh = ss.getSheetByName(GRANT_CONFIG.SHEETS.GRANTS);
      if (!sh || sh.getLastRow() <= 1) return [];
      const data = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
      return data.flat()
        .filter(function(v){ return v && v.toString().trim(); })
        .map(function(v){ return v.toString().trim(); });
    } catch (e) {
      Logger.log('❌ getExistingGrantNames: ' + e.message);
      return [];
    }
  },

  // Updated to properly map to the corrected column structure (A-BE with Days_Left in column B)
  addGrantsToNewSheet(grants) {
    try {
      const ss = CoreUtils.getSpreadsheetSafely();
      const newSh = ss.getSheetByName(GRANT_CONFIG.SHEETS.NEW_GRANTS);
      if (!newSh) throw new Error('New_Grants sheet not found');

      const existingNames = newSh.getLastRow() > 1
        ? newSh.getRange(2, 1, newSh.getLastRow() - 1, 1).getValues()
            .flat().filter(Boolean)
            .map(function(n){ return n.toString().trim().toLowerCase(); })
        : [];

      const unique = (grants || []).filter(function(g){
        return !existingNames.includes(String(g.grantName || '').toLowerCase());
      });

      if (unique.length === 0) {
        Logger.log('No unique grants to add');
        return 0;
      }

      const today = new Date();
      
      // Build rows with correct column mapping for the corrected structure (A-BE with Days_Left in B)
      const rows = unique.map(function(g){
        // ✅ CALCULATE DAYS LEFT PROPERLY FOR EACH GRANT
        const daysLeft = g.daysLeft || DateUtils.calculateDaysLeft(g.deadline);
        
        return [
          g.grantName,                                  // A: Grant_Name
          daysLeft,                                     // B: Days_Left (CORRECT POSITION)
          g.sponsorOrg,                                 // C: Sponsor_Org
          '',                                           // D: Contact_Person
          g.focusArea,                                  // E: Focus_Area
          g.amount || '',                               // F: Amount
          g.deadline,                                   // G: Deadline (Est.)
          'New',                                        // H: Status
          '',                                           // I: Draft_Pitch
          '',                                           // J: reporting requirements
          '',                                           // K: renewable
          g.eligibility,                                // L: Eligibility Summary
          '',                                           // M: Application Link
          g.notes,                                      // N: Notes
          g.discoverySource || 'AI Discovery',          // O: Discovery_Source
          '',                                           // P: Source_Reliability_Score
          'California',                                 // Q: Geographic_Scope (default)
          'Foundation',                                 // R: Funder_Type (best guess)
          DateUtils.formatDateForSheet(today),          // S: Last_Discovery_Date
          
          // Scoring placeholders (T-AK) - 18 columns
          '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
          
          // Dual-track columns with defaults (AL-BE) - 20 columns
          'Both',                                       // AL: Eligible_For
          'Current LLC',                                // AM: Structure_Recommendation
          'Immediate (LLC)',                            // AN: Current_Priority
          'Year 1',                                     // AO: Foundation_Timeline
          'Corporate Partnership',                      // AP: LLC_Funding_Type
          '',                                           // AQ: Corporate_CSR_Alignment
          '',                                           // AR: Silicon_Valley_Advantage
          '',                                           // AS: Revenue_Model_Fit
          '',                                           // AT: Partnership_Potential
          'Yes',                                        // AU: Dual_Opportunity
          'Immediate',                                  // AV: Strategic_Timing
          '',                                           // AW: Market_Positioning
          '',                                           // AX: Scalability_Potential_DT
          '',                                           // AY: LLC_Priority_Score
          '',                                           // AZ: Foundation_Priority_Score
          '',                                           // BA: Overall_Strategic_Value
          '',                                           // BB: Competitive_Advantage
          '',                                           // BC: Risk_Assessment_DT
          '',                                           // BD: ROI_Potential
          ''                                            // BE: Strategic_Alignment
        ];
      });

      const start = newSh.getLastRow() + 1;
      newSh.getRange(start, 1, rows.length, rows[0].length).setValues(rows);

      Logger.log('✅ Added ' + unique.length + ' grants to New_Grants with correct column mapping');
      return unique.length;
    } catch (e) {
      Logger.log('❌ addGrantsToNewSheet: ' + e.message);
      throw e;
    }
  },

  // ====== RESEARCH (CHUNKED) ======

  // Cursor helpers stored in Document Properties
  getResearchCursor() {
    try {
      const props = PropertiesService.getDocumentProperties();
      const v = props.getProperty('RESEARCH_CURSOR');
      return v ? parseInt(v, 10) : 0;
    } catch (e) {
      Logger.log('⚠️ getResearchCursor error: ' + e.message);
      return 0;
    }
  },

  setResearchCursor(idx) {
    try {
      PropertiesService.getDocumentProperties().setProperty('RESEARCH_CURSOR', String(idx));
    } catch (e) {
      Logger.log('⚠️ setResearchCursor error: ' + e.message);
    }
  },

  resetResearchCursor() {
    try {
      PropertiesService.getDocumentProperties().deleteProperty('RESEARCH_CURSOR');
    } catch (e) {
      Logger.log('⚠️ resetResearchCursor error: ' + e.message);
    }
  },

  researchGrants() {
    const ui = SpreadsheetApp.getUi();

    // Batch size = 12 by default; respects GRANT_CONFIG if present
    const BATCH_SIZE = (GRANT_CONFIG && GRANT_CONFIG.BATCH && GRANT_CONFIG.BATCH.RESEARCH_SIZE)
      ? GRANT_CONFIG.BATCH.RESEARCH_SIZE
      : 12;

    // Time budget (~90s) to avoid Apps Script timeouts
    const TIME_BUDGET_MS = 90 * 1000;

    const res = ui.alert(
      'Research Grants',
      'Research grants in New_Grants using AI (chunked to avoid timeouts).\n\n' +
        'This processes about ' + BATCH_SIZE + ' at a time and can resume where it left off.\n\n' +
        'Continue?',
      ui.ButtonSet.YES_NO
    );
    if (res !== ui.Button.YES) return;

    try {
      const sheet = CoreUtils.getSheetSafely(GRANT_CONFIG.SHEETS.NEW_GRANTS);
      if (sheet.getLastRow() <= 1) {
        ui.alert('No Grants Found', 'No grants found to research.', ui.ButtonSet.OK);
        return;
      }

      const data = sheet.getDataRange().getValues();
      const map = CoreUtils.createColumnMapping(sheet);

      // Build candidates: must have Grant_Name; not already Research_Complete
      const rows = [];
      for (let i = 1; i < data.length; i++) {
        const grantName = data[i][0];
        if (!grantName) continue;
        const done = map['Research_Complete'] !== undefined ? !!data[i][map['Research_Complete']] : false;
        if (!done) rows.push({ rowIndex: i + 1, name: grantName }); // 1-based row number
      }

      if (rows.length === 0) {
        this.resetResearchCursor();
        ui.alert('All Done', 'All rows are already researched. 🎉', ui.ButtonSet.OK);
        return;
      }

      // Resume from saved cursor
      let cursor = this.getResearchCursor();
      if (cursor >= rows.length) cursor = 0;

      const startTime = Date.now();
      let processed = 0, ok = 0, bad = 0;

      while (processed < BATCH_SIZE && cursor < rows.length) {
        if (Date.now() - startTime > TIME_BUDGET_MS) {
          Logger.log('⏱️ Time budget reached; saving cursor at ' + cursor);
          break;
        }

        const item = rows[cursor];
        try {
          const resp = this.researchSingleGrant(item.name); // uses forceJson
          if (resp.success) {
            this.updateGrantWithResearch(sheet, item.rowIndex, resp.data, map);
            ok++;
          } else {
            bad++;
            Logger.log('❌ Research failed for: ' + item.name + ' — ' + (resp.error || 'unknown'));
          }
        } catch (e) {
          bad++;
          Logger.log('❌ Exception researching ' + item.name + ': ' + e.message);
        }

        processed++;
        cursor++;
      }

      // Save cursor (absolute position within filtered list)
      this.setResearchCursor(cursor);

      const remaining = rows.length - cursor;
      const msg = 'Processed: ' + processed + ' (OK: ' + ok + ', Errors: ' + bad + ')\n' +
                  'Remaining: ' + remaining + '\n' +
                  (remaining > 0 ? 'Run "Research Grants" again to continue.' : 'All research complete! 🎉');

      ui.alert('Research Batch Complete', msg, ui.ButtonSet.OK);

      if (remaining <= 0) this.resetResearchCursor();

      CoreUtils.logSystemEvent('Grant Research (Chunked)', 'Success', 'OK:' + ok + ' Err:' + bad + ' Rem:' + remaining);

    } catch (error) {
      Logger.log('❌ Research error: ' + error.message);
      ui.alert('❌ Research Error', error.message, ui.ButtonSet.OK);
    }
  },

  // === Stricter research prompt that requests contactName/contactEmail/contactUrl ===
  researchSingleGrant(grantName) {
    try {
      const prompt =
`Research the grant: "${grantName}"

CRITICAL: Only provide information about grants with CURRENT deadlines (2025 or later) or rolling applications.

Provide ONLY this JSON:
{
  "found": true,
  "sponsorOrg": "Organization name",
  "contactName": "Person or team name if available",
  "contactEmail": "Official email if available",
  "contactUrl": "Official contact page URL if available",
  "focusArea": "Target audience/focus",
  "amount": 25000,
  "deadline": "MM/DD/YYYY or Rolling",
  "eligibility": "Key requirements (<=200 chars)",
  "applicationLink": "Direct application URL if available",
  "notes": "Important details (<=300 chars)"
}

Rules:
- Prefer official emails (domain of the sponsor) over generic directories.
- If no person, use team/department (e.g., "Grants Team").
- If no email, give an official contact URL.
- If neither email nor URL is findable, set contact fields to "".
- If deadline is expired (2024 or earlier), return: {"found": false}
- If you cannot find reliable information, return: {"found": false}`;

      // Force strict JSON back from the API
      const resp = APIUtils.callOpenAI(prompt, { temperature: 0.1, maxTokens: 900, forceJson: true });
      if (resp.success) {
        const data = this.parseResearchResponse(resp.data);
        return data.found ? { success: true, data: data } : { success: false, error: 'Not found' };
      }
      return { success: false, error: resp.error };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // Hardened parser that builds a single Contact_Person string
  parseResearchResponse(responseData) {
    try {
      let raw = responseData;

      // Unwrap our standard result shape {success, data}
      if (raw && typeof raw === 'object' && Object.prototype.hasOwnProperty.call(raw, 'data')) {
        raw = raw.data;
      }
      // If we got a raw OpenAI response
      if (raw && typeof raw === 'object' && raw.choices) {
        const content = raw.choices && raw.choices[0] && raw.choices[0].message
          ? raw.choices[0].message.content
          : null;
        raw = (typeof content === 'string') ? content : JSON.stringify(raw);
      }
      if (raw && typeof raw === 'object') { try { raw = JSON.stringify(raw); } catch (_) { raw = String(raw); } }

      let txt = String(raw || '').trim().replace(/```json/gi, '').replace(/```/g, '').trim();

      // Try object parse first (expected with forceJson)
      let parsed;
      try {
        parsed = JSON.parse(txt);
      } catch (e1) {
        const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
        if (a !== -1 && b > a) parsed = JSON.parse(txt.slice(a, b + 1));
        else throw e1;
      }

      if (!parsed || parsed.found === false) return { found: false };

      // Build a friendly Contact_Person string from available bits
      const contactName  = CoreUtils.cleanString(parsed.contactName || '');
      const contactEmail = CoreUtils.cleanString(parsed.contactEmail || '');
      const contactUrl   = CoreUtils.cleanString(parsed.contactUrl || '');
      const parts = [];
      if (contactName) parts.push(contactName);
      if (contactEmail) parts.push(contactEmail);
      if (!contactEmail && contactUrl) parts.push(contactUrl); // if no email, at least a URL
      const contactPerson = parts.join(' | ');

      return {
        found: true,
        sponsorOrg: CoreUtils.cleanString(parsed.sponsorOrg || ''),
        contactPerson: contactPerson,
        focusArea: CoreUtils.cleanString(parsed.focusArea || ''),
        amount: parseInt(parsed.amount, 10) || null,
        deadline: CoreUtils.cleanString(parsed.deadline || ''),
        eligibility: CoreUtils.cleanString(parsed.eligibility || ''),
        applicationLink: CoreUtils.cleanString(parsed.applicationLink || ''),
        notes: CoreUtils.cleanString(parsed.notes || '')
      };
    } catch (e) {
      Logger.log('❌ Parse research response (hardened): ' + e.message);
      return { found: false };
    }
  },

  // Only marks complete if contact/app link exists, always stamps Last_Updated
  updateGrantWithResearch(sheet, rowNumber, d, map) {
    try {
      const updates = {
        'Sponsor_Org': d.sponsorOrg,
        'Contact_Person': d.contactPerson,
        'Focus_Area': d.focusArea,
        'Amount': d.amount,
        'Deadline (Est.)': d.deadline,
        'Eligibility Summary': d.eligibility,
        'Application Link': d.applicationLink,
        'Notes': d.notes
      };
      Object.keys(updates).forEach(function(k) {
        const v = updates[k];
        const c = map[k];
        if (c !== undefined && v !== undefined && v !== '') {
          sheet.getRange(rowNumber, c + 1).setValue(v);
        }
      });

      // Update Days_Left if we have a deadline
      if (map['Days_Left'] !== undefined && d.deadline) {
        const dl = DateUtils.calculateDaysLeft(d.deadline);
        sheet.getRange(rowNumber, map['Days_Left'] + 1).setValue(dl);
      }

      // ✅ Only mark complete if contact or application link is present
      const hasContact = !!(d.contactPerson && d.contactPerson.trim());
      const hasAppLink = !!(d.applicationLink && d.applicationLink.trim());
      if (map['Research_Complete'] !== undefined) {
        sheet.getRange(rowNumber, map['Research_Complete'] + 1).setValue(hasContact || hasAppLink);
      }

      // Always stamp Last_Updated
      if (map['Last_Updated'] !== undefined) {
        sheet.getRange(rowNumber, map['Last_Updated'] + 1).setValue(new Date());
      }

      return true;
    } catch (e) {
      Logger.log('❌ Update research row: ' + e.message);
      return false;
    }
  },

  // ✅ NEW: CLEANUP FUNCTION FOR EXISTING EXPIRED GRANTS
  /**
   * Remove expired grants from existing data
   */
  cleanupExpiredGrants() {
    const ui = SpreadsheetApp.getUi();
    
    const response = ui.alert(
      'Clean Expired Grants',
      'This will remove grants with expired deadlines (2024 and earlier) from your sheets.\n\n' +
      '⚠️ This action cannot be undone.\n\n' +
      'Continue?',
      ui.ButtonSet.YES_NO
    );
    
    if (response !== ui.Button.YES) return;
    
    try {
      const ss = CoreUtils.getSpreadsheetSafely();
      const newGrantsSheet = ss.getSheetByName(GRANT_CONFIG.SHEETS.NEW_GRANTS);
      const grantsSheet = ss.getSheetByName(GRANT_CONFIG.SHEETS.GRANTS);
      
      let removedCount = 0;
      
      // Clean New_Grants sheet
      if (newGrantsSheet && newGrantsSheet.getLastRow() > 1) {
        removedCount += this.cleanExpiredFromSheet(newGrantsSheet);
      }
      
      // Clean main Grants sheet
      if (grantsSheet && grantsSheet.getLastRow() > 1) {
        removedCount += this.cleanExpiredFromSheet(grantsSheet);
      }
      
      ui.alert(
        '✅ Cleanup Complete',
        `Removed ${removedCount} expired grants.\n\n` +
        'Your sheets now contain only current opportunities.',
        ui.ButtonSet.OK
      );
      
      CoreUtils.logSystemEvent('Expired Grant Cleanup', 'Success', `Removed ${removedCount} grants`);
      
    } catch (error) {
      Logger.log('❌ Cleanup error: ' + error.message);
      ui.alert('❌ Cleanup Error', `Failed to clean expired grants: ${error.message}`, ui.ButtonSet.OK);
    }
  },

  /**
   * Clean expired grants from a specific sheet
   */
  cleanExpiredFromSheet(sheet) {
    try {
      const data = sheet.getDataRange().getValues();
      const map = CoreUtils.createColumnMapping(sheet);
      const deadlineCol = map['Deadline (Est.)'];
      
      if (deadlineCol === undefined) {
        Logger.log(`⚠️ No deadline column found in ${sheet.getName()}`);
        return 0;
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const rowsToDelete = [];
      
      // Check each data row (skip header)
      for (let i = 1; i < data.length; i++) {
        const deadline = data[i][deadlineCol];
        const grantName = data[i][0];
        
        if (!deadline || this.isRollingGrant(deadline)) {
          // Keep rolling grants and undefined deadlines
          continue;
        }
        
        const parsedDate = this.parseGrantDeadline(deadline);
        if (parsedDate) {
          parsedDate.setHours(23, 59, 59, 999);
          if (parsedDate < today) {
            // Expired grant - mark for deletion
            rowsToDelete.push(i + 1); // Convert to 1-based row number
            Logger.log(`🗑️ Marking for deletion: ${grantName} (expired: ${deadline})`);
          }
        }
      }
      
      // Delete rows from bottom to top to maintain row indices
      rowsToDelete.reverse().forEach(rowNumber => {
        sheet.deleteRow(rowNumber);
      });
      
      Logger.log(`✅ Removed ${rowsToDelete.length} expired grants from ${sheet.getName()}`);
      return rowsToDelete.length;
      
    } catch (error) {
      Logger.log(`❌ Error cleaning ${sheet.getName()}: ${error.message}`);
      return 0;
    }
  }
};

// === WRAPPER FUNCTIONS FOR MENU ACCESS ===

/**
 * Main discovery function - wrapper for menu access
 */
function autoDiscoverGrants() {
  return GrantDiscovery.autoDiscoverGrants();
}

/**
 * Research grants function - wrapper for menu access
 */
function researchGrants() {
  return GrantDiscovery.researchGrants();
}

/**
 * Clean up expired grants - wrapper for menu access
 */
function cleanupExpiredGrants() {
  return GrantDiscovery.cleanupExpiredGrants();
}

// === TESTING FUNCTIONS (VERIFIED) ===

/**
 * Test function to verify deadline validation is working - VERIFIED VERSION
 */
function testDeadlineValidation() {
  console.log('🧪 TESTING DEADLINE VALIDATION (VERIFIED)');
  console.log('==========================================');
  
  try {
    // Test grants with various deadline formats
    const testGrants = [
      { grantName: 'Test Expired Grant', deadline: '09/30/2023' },
      { grantName: 'Test Future Grant', deadline: '12/15/2025' }, // Changed to December to ensure it's future
      { grantName: 'Test Rolling Grant', deadline: 'Rolling' },
      { grantName: 'Test Ongoing Grant', deadline: 'Ongoing applications' },
      { grantName: 'Test Bad Date', deadline: 'Invalid date' },
      { grantName: 'Test No Date', deadline: '' }
    ];
    
    console.log('Testing individual date parsing...');
    testGrants.forEach(grant => {
      if (grant.deadline && !GrantDiscovery.isRollingGrant(grant.deadline)) {
        const parsed = GrantDiscovery.parseGrantDeadline(grant.deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (parsed) {
          parsed.setHours(23, 59, 59, 999);
          const isValid = parsed >= today;
          console.log(`🔍 ${grant.grantName}: "${grant.deadline}" → ${parsed.toDateString()} → ${isValid ? 'VALID' : 'EXPIRED'}`);
        } else {
          console.log(`🔍 ${grant.grantName}: "${grant.deadline}" → null → UNPARSEABLE`);
        }
      } else {
        console.log(`🔍 ${grant.grantName}: "${grant.deadline}" → ROLLING/EMPTY`);
      }
    });
    
    console.log('\nTesting filterValidGrants function...');
    const validGrants = GrantDiscovery.filterValidGrants(testGrants);
    
    console.log(`\nResults: ${validGrants.length}/${testGrants.length} grants kept`);
    
    validGrants.forEach(grant => {
      console.log(`✅ Kept: ${grant.grantName} (${grant.deadline})`);
    });
    
    const filtered = testGrants.filter(g => !validGrants.find(v => v.grantName === g.grantName));
    filtered.forEach(grant => {
      console.log(`❌ Filtered: ${grant.grantName} (${grant.deadline})`);
    });
    
    // ✅ EXPECTED RESULTS CHECK
    const expectedKeep = ['Test Future Grant', 'Test Rolling Grant', 'Test Ongoing Grant'];
    const expectedFilter = ['Test Expired Grant'];
    
    let testPassed = true;
    
    console.log('\n🎯 Validating expected results...');
    expectedKeep.forEach(name => {
      if (validGrants.find(g => g.grantName === name)) {
        console.log(`✅ CORRECT: ${name} was kept`);
      } else {
        console.log(`❌ ERROR: ${name} should have been kept but was filtered`);
        testPassed = false;
      }
    });
    
    expectedFilter.forEach(name => {
      if (!validGrants.find(g => g.grantName === name)) {
        console.log(`✅ CORRECT: ${name} was filtered out`);
      } else {
        console.log(`❌ ERROR: ${name} should have been filtered but was kept`);
        testPassed = false;
      }
    });
    
    if (testPassed) {
      console.log('\n🎉 DEADLINE VALIDATION TEST PASSED!');
    } else {
      console.log('\n❌ DEADLINE VALIDATION TEST FAILED');
    }
    
    return testPassed;
    
  } catch (error) {
    console.error('❌ Test failed:', error.toString());
    return false;
  }
}

/**
 * Console-safe version
 */
function testDeadlineValidationConsole() {
  return testDeadlineValidation();
}

/**
 * Menu-safe version with UI alerts
 */
function testDeadlineValidationFromMenu() {
  try {
    const result = testDeadlineValidation();
    
    SpreadsheetApp.getUi().alert(
      'Deadline Validation Test',
      `Test completed!\n\n` +
      `Result: ${result ? 'PASSED ✅' : 'FAILED ❌'}\n\n` +
      'Check console (View → Logs) for detailed results.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
    return result;
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Test Error', `Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test function to verify column mapping is working correctly
 */
function testGrantDiscoveryMapping() {
  console.log('🧪 TESTING GRANT DISCOVERY COLUMN MAPPING');
  console.log('==========================================');
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('New_Grants');
    
    if (!sheet) {
      console.log('❌ New_Grants sheet not found');
      return false;
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    console.log(`📊 Found ${headers.length} headers in New_Grants`);
    
    // Test with sample grant data
    const testGrant = {
      grantName: "TEST: Column Mapping Verification",
      sponsorOrg: "Test Foundation", 
      amount: 50000,
      deadline: "12/31/2025",
      focusArea: "women of color leadership/community development",
      eligibility: "Test eligibility requirements",
      notes: "Test mapping verification",
      discoverySource: "Test",
      discoveryDate: new Date()
    };
    
    console.log('🔧 Testing grant addition with current mapping...');
    
    // Verify header positions
    const expectedPositions = {
      'Grant_Name': 0,
      'Days_Left': 1,
      'Sponsor_Org': 2,
      'Contact_Person': 3,
      'Focus_Area': 4,
      'Amount': 5,
      'Deadline (Est.)': 6,
      'Status': 7
    };
    
    let mappingCorrect = true;
    Object.entries(expectedPositions).forEach(([header, expectedIndex]) => {
      const actualIndex = headers.indexOf(header);
      if (actualIndex === expectedIndex) {
        console.log(`  ✅ ${header}: Column ${String.fromCharCode(65 + actualIndex)} (correct)`);
      } else {
        console.log(`  ❌ ${header}: Expected column ${String.fromCharCode(65 + expectedIndex)}, found ${actualIndex >= 0 ? String.fromCharCode(65 + actualIndex) : 'missing'}`);
        mappingCorrect = false;
      }
    });
    
    if (mappingCorrect) {
      console.log('✅ Column mapping verification successful!');
      console.log('🎯 GrantDiscovery.addGrantsToNewSheet should work correctly');
    } else {
      console.log('❌ Column mapping has issues');
      console.log('🔧 Check that your sheet headers match the expected structure');
    }
    
    return mappingCorrect;
    
  } catch (error) {
    console.error('❌ Test failed:', error.toString());
    return false;
  }
}

/**
 * Fix existing misaligned data in New_Grants sheet
 */
function fixMisalignedDiscoveryData() {
  console.log('🔧 FIXING MISALIGNED DISCOVERY DATA');
  console.log('===================================');
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('New_Grants');
    
    if (!sheet) {
      console.log('❌ New_Grants sheet not found');
      SpreadsheetApp.getUi().alert('❌ Error', 'New_Grants sheet not found');
      return;
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      console.log('No data to fix');
      SpreadsheetApp.getUi().alert('No Data', 'No data found to fix in New_Grants sheet');
      return;
    }
    
    // Get current headers and data
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    
    console.log(`Found ${headers.length} headers and ${data.length} data rows`);
    
    // Clear existing data (keep headers)
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }
    
    let fixedCount = 0;
    
    // Process each row and re-map correctly
    data.forEach((row, index) => {
      if (row[0] && row[0].toString().trim()) { // If there's a grant name
        // Try to extract meaningful data from misaligned row
        const grantData = {
          grantName: row[0] || '',
          sponsorOrg: row[2] || row[1] || '',  // Try different positions
          amount: row[4] || row[3] || '',       // Try different positions
          deadline: row[6] || row[5] || '',     // Try different positions
          focusArea: row[4] || 'women of color leadership/community development',
          eligibility: row[11] || row[12] || '',
          notes: 'AI Discovery - Fixed alignment',
          discoverySource: 'AI Discovery'
        };
        
        // Use GrantDiscovery.addGrantsToNewSheet to add correctly
        try {
          const added = GrantDiscovery.addGrantsToNewSheet([grantData]);
          if (added > 0) {
            fixedCount++;
            console.log(`  ✅ Fixed: ${grantData.grantName}`);
          }
        } catch (error) {
          console.log(`  ❌ Failed to fix: ${grantData.grantName} - ${error.message}`);
        }
      }
    });
    
    console.log(`✅ Fixed ${fixedCount} misaligned grants`);
    
    SpreadsheetApp.getUi().alert(
      '✅ Data Fixed',
      `Successfully fixed ${fixedCount} misaligned grants.\n\n` +
      'The data is now properly aligned with your column structure.\n' +
      'Days_Left is in column B, Sponsor_Org in column C, etc.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    console.error('❌ Fix failed:', error.toString());
    SpreadsheetApp.getUi().alert('❌ Fix Error', `Failed to fix data: ${error.message}`);
  }
}