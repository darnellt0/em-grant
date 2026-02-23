// ============================================
// Module11_UnadvertisedFinder.gs
// "Unadvertised Grant Finder" for Elevated Movements
// - Creates Unadvertised_Leads sheet (pipeline)
// - Paste 990 text -> AI parses funders to rows
// - AI enrichment for a selected lead row
// - Weekly digest trigger + formatting
// - No external scraping; AI-only enrichment (safe for Apps Script)
// DEPENDS ON: CoreUtils, APIUtils, GRANT_CONFIG, DateUtils
// ============================================


const UnadvertisedFinder = {


  CONFIG: {
    SHEET: 'Unadvertised_Leads',
    PASTEBIN: '990_Pastebin',
    DIGEST_HOUR_LOCAL: 9 // 9am local
  },


  // ---------- PUBLIC ENTRY POINTS (bind these to menu) ----------


  setupUnadvertisedFinder() {
    const ss = CoreUtils.getSpreadsheetSafely();
    let leads = ss.getSheetByName(this.CONFIG.SHEET);
    if (!leads) {
      leads = ss.insertSheet(this.CONFIG.SHEET);
      this._setupLeadsHeaders(leads);
      this._applyLeadsFormatting(leads);
    }


    let paste = ss.getSheetByName(this.CONFIG.PASTEBIN);
    if (!paste) {
      paste = ss.insertSheet(this.CONFIG.PASTEBIN);
      paste.getRange(1, 1).setValue('📎 Paste 990 / annual report / funder list text in A2 downward.');
      paste.getRange(1, 1).setFontWeight('bold').setFontSize(12);
      paste.setFrozenRows(1);
      paste.setColumnWidth(1, 900);
    }


    SpreadsheetApp.getUi().alert('✅ Unadvertised Finder setup complete.\n\nSheets added:\n• Unadvertised_Leads\n• 990_Pastebin');
    CoreUtils.logSystemEvent('UnadvertisedFinder Setup', 'Success', 'Created sheets & formatting');
  },


  importFundersFrom990Paste() {
    const ui = SpreadsheetApp.getUi();
    const ss = CoreUtils.getSpreadsheetSafely();
    const paste = ss.getSheetByName(this.CONFIG.PASTEBIN);
    if (!paste) {
      ui.alert('❌ Missing', `Sheet "${this.CONFIG.PASTEBIN}" not found. Run setup first.`, ui.ButtonSet.OK);
      return;
    }


    const lastRow = paste.getLastRow();
    if (lastRow < 2) {
      ui.alert('No Text Found', 'Paste 990/annual report text into 990_Pastebin (cell A2 downward) and try again.', ui.ButtonSet.OK);
      return;
    }


    const numRows = lastRow - 1;
    if (numRows < 1) {
      ui.alert('No Text Found', 'Paste 990/annual report text into 990_Pastebin (cell A2 downward) and try again.', ui.ButtonSet.OK);
      return;
    }


    const values = paste.getRange(2, 1, numRows, 1).getValues().flat();
    const textBlocks = values
      .map(v => (v == null ? '' : String(v).trim()))
      .filter(v => v.length > 0);


    if (textBlocks.length === 0) {
      ui.alert('No Text Found', 'Only blank rows detected. Paste actual 990/annual report text and try again.', ui.ButtonSet.OK);
      return;
    }


    ui.alert('Parsing 990 text…', 'AI will extract funders and normalize them. This takes ~30–60s.', ui.ButtonSet.OK);


    const prompt = this._build990ExtractPrompt(textBlocks.join('\n\n---\n\n'));
    const resp = APIUtils.callOpenAI(prompt, { temperature: 0.2, maxTokens: 1200, forceJson: true, noCache: true });


    if (!resp || !resp.success) {
      ui.alert('❌ Parse Failed', `AI parse error: ${resp && resp.error ? resp.error : 'unknown'}`, ui.ButtonSet.OK);
      return;
    }


    const items = this._parse990ExtractResponse(resp.data);
    if (!items || items.length === 0) {
      ui.alert('No Funders Found', 'AI could not reliably extract funders from the pasted text.', ui.ButtonSet.OK);
      return;
    }


    const leads = ss.getSheetByName(this.CONFIG.SHEET);
    const added = this._appendLeads(leads, items);
    this._applyLeadsFormatting(leads);


    ui.alert('✅ Import Complete', `Added ${added} funder leads to "${this.CONFIG.SHEET}".`, ui.ButtonSet.OK);
    CoreUtils.logSystemEvent('990 Import', 'Success', `Added ${added} leads`);
  },


  enrichSelectedLead() {
    const ui = SpreadsheetApp.getUi();
    const sheet = CoreUtils.getSheetSafely(this.CONFIG.SHEET);
    const sel = sheet.getActiveRange();
    if (!sel || sel.getNumRows() !== 1) {
      ui.alert('Select One Row', 'Click a single lead row to enrich (one row at a time).', ui.ButtonSet.OK);
      return;
    }


    const row = sel.getRow();
    if (row === 1) {
      ui.alert('Header Row', 'Select a data row, not the header.', ui.ButtonSet.OK);
      return;
    }


    const map = this._colMap(sheet);
    const rowVals = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const lead = this._rowToLead(rowVals, map);


    ui.alert('Enriching Lead…', `AI will add contact hints, unsolicited policy, and notes for:\n\n${lead.funderName}`, ui.ButtonSet.OK);


    const prompt = this._buildEnrichmentPrompt(lead);
    const resp = APIUtils.callOpenAI(prompt, { temperature: 0.4, maxTokens: 800, forceJson: true, noCache: true });
    if (!resp || !resp.success) {
      ui.alert('❌ Enrichment Failed', resp && resp.error ? resp.error : 'Unknown error', ui.ButtonSet.OK);
      return;
    }


    const data = this._parseEnrichment(resp.data);
    this._writeEnrichment(sheet, row, map, data);


    ui.alert('✅ Lead Enriched', 'Fields updated from AI enrichment.', ui.ButtonSet.OK);
    CoreUtils.logSystemEvent('Lead Enrichment', 'Success', lead.funderName);
  },


  createWeeklyDigestTrigger() {
    this.deleteWeeklyDigestTrigger(); // idempotent
    ScriptApp.newTrigger('unadvertisedWeeklyDigest')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(this.CONFIG.DIGEST_HOUR_LOCAL)
      .create();
    SpreadsheetApp.getUi().alert('✅ Weekly digest trigger created (Mondays).');
  },


  deleteWeeklyDigestTrigger() {
    const all = ScriptApp.getProjectTriggers() || [];
    all.forEach(t => {
      if (t.getHandlerFunction && t.getHandlerFunction() === 'unadvertisedWeeklyDigest') {
        ScriptApp.deleteTrigger(t);
      }
    });
  },


  weeklyDigest() {
    try {
      const ss = CoreUtils.getSpreadsheetSafely();
      const leads = ss.getSheetByName(this.CONFIG.SHEET);
      if (!leads || leads.getLastRow() <= 1) return;


      const map = this._colMap(leads);
      const data = leads.getRange(2, 1, leads.getLastRow() - 1, leads.getLastColumn()).getValues();


      const today = new Date();
      const dueSoon = [];
      const newThisWeek = [];


      data.forEach(r => {
        const nextCheck = r[map['Next_Check_In']];
        const dateAdded = r[map['Date_Added']];
        const funder = r[map['Funder_Name']];
        const warmth = r[map['Warmth']];


        if (dateAdded && this._daysSince(dateAdded, today) <= 7) {
          newThisWeek.push(funder);
        }
        if (nextCheck && this._daysUntil(nextCheck, today) <= 7) {
          dueSoon.push(`${funder} (${warmth || 'Cold'})`);
        }
      });


      const details = `New leads (7d): ${newThisWeek.length}\nDue within 7d: ${dueSoon.length}`;
      CoreUtils.logSystemEvent('Unadvertised Digest', 'Success', details);
      SpreadsheetApp.getActive().toast(`Unadvertised Digest — New: ${newThisWeek.length}, Due: ${dueSoon.length}`, 'Weekly Digest', 8);
    } catch (e) {
      CoreUtils.logSystemEvent('Unadvertised Digest', 'Error', e.message);
    }
  },


  // ---------- INTERNALS ----------


  _setupLeadsHeaders(sheet) {
    const headers = [
      'Funder_Name', 'Funder_Type', 'Geographic_Scope', 'Explicit_Women_Signal',
      'Average_Grant_USD', 'Website', 'Accepts_Unsolicited', 'Primary_Program_Areas',
      'Contact_Name', 'Contact_Email', 'Contact_Role',
      'Source', 'Source_Notes',
      'Warmth', 'Relationship_Notes',
      'Next_Check_In', 'Date_Added', 'Last_Updated'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#2f4858').setFontColor('white');
    sheet.setFrozenRows(1);


    const widths = [240, 140, 140, 120, 140, 220, 150, 220, 180, 200, 160, 140, 240, 120, 280, 130, 130, 130];
    widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  },


  _applyLeadsFormatting(sheet) {
    if (sheet.getLastRow() <= 1) return;


    sheet.clearConditionalFormatRules();
    const rules = [];


    const map = this._colMap(sheet);
    if (map['Warmth'] !== undefined) {
      const r = sheet.getRange(2, map['Warmth'] + 1, sheet.getLastRow() - 1, 1);
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .setRanges([r])
        .whenTextEqualTo('Hot').setBackground('#ffe5cc').build());
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .setRanges([r])
        .whenTextEqualTo('Warm').setBackground('#e6ffed').build());
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .setRanges([r])
        .whenTextEqualTo('Cold').setBackground('#f0f0f0').build());
      sheet.setConditionalFormatRules(rules);
    }
  },


  _colMap(sheet) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const map = {};
    headers.forEach((h, i) => { if (h) map[String(h).trim()] = i; });
    return map;
  },


  _rowToLead(row, map) {
    return {
      funderName: row[map['Funder_Name']] || '',
      funderType: row[map['Funder_Type']] || '',
      scope: row[map['Geographic_Scope']] || '',
      website: row[map['Website']] || '',
      explicitWomen: row[map['Explicit_Women_Signal']] || '',
      avgGrant: row[map['Average_Grant_USD']] || '',
      programAreas: row[map['Primary_Program_Areas']] || '',
      contactName: row[map['Contact_Person']] || '',
      contactEmail: row[map['Contact_Email']] || '',
      contactRole: row[map['Contact_Role']] || '',
      source: row[map['Source']] || '',
      sourceNotes: row[map['Source_Notes']] || ''
    };
  },


  _appendLeads(sheet, items) {
    const map = this._colMap(sheet);
    const existing = sheet.getLastRow() > 1
      ? sheet.getRange(2, map['Funder_Name'] + 1, sheet.getLastRow() - 1, 1).getValues().flat()
          .filter(Boolean).map(v => String(v).trim().toLowerCase())
      : [];


    const today = new Date();
    const rows = [];


    items.forEach(it => {
      const name = String(it.funderName || '').trim();
      if (!name) return;
      if (existing.includes(name.toLowerCase())) return;


      rows.push([
        name,
        it.funderType || 'Private Foundation',
        it.geographicScope || 'Unknown',
        it.explicitWomenSignal || 'Unknown',
        it.averageGrantUsd || '',
        it.website || '',
        it.acceptsUnsolicited || 'Unknown',
        it.primaryProgramAreas || '',
        it.contactName || '',
        it.contactEmail || '',
        it.contactRole || '',
        it.source || '990 Extract',
        it.sourceNotes || '',
        'Cold', // Warmth default
        '',     // Relationship_Notes
        '',     // Next_Check_In
        today,
        today
      ]);
    });


    if (rows.length === 0) return 0;


    const start = sheet.getLastRow() + 1;
    sheet.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
    return rows.length;
  },


  _build990ExtractPrompt(text) {
    return `You are extracting funders from pasted IRS 990 or annual report text.


Return ONLY this JSON (no prose, no markdown):
{
  "items": [
    {
      "funderName": "Exact legal or public name",
      "funderType": "Private Foundation | Community Foundation | Corporate Foundation | Family Foundation | Federal Agency | State/Local Agency | Donor-Advised Fund | Other",
      "geographicScope": "Local/Regional | State | National | International | Unknown",
      "explicitWomenSignal": "Yes | No | Unknown",
      "averageGrantUsd": 25000,
      "website": "https://...",
      "acceptsUnsolicited": "Yes | No | Unknown",
      "primaryProgramAreas": "comma-separated",
      "contactName": "if public",
      "contactEmail": "if public",
      "contactRole": "if public",
      "source": "990 Extract",
      "sourceNotes": "short justification if needed"
    }
  ]
}


Consider only likely grantmaking entities. From text below:
---
${text}`;
  },


  _parse990ExtractResponse(raw) {
    try {
      let txt = typeof raw === 'string' ? raw : JSON.stringify(raw);
      txt = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
      let parsed;
      try { parsed = JSON.parse(txt); }
      catch (e1) {
        const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
        if (a !== -1 && b > a) parsed = JSON.parse(txt.slice(a, b + 1));
        else throw e1;
      }
      let items = [];
      if (Array.isArray(parsed)) items = parsed;
      else if (parsed && Array.isArray(parsed.items)) items = parsed.items;
      else if (parsed) items = [parsed];
      return items.map(it => ({
        funderName: CoreUtils.cleanString(it.funderName || it.name || ''),
        funderType: CoreUtils.cleanString(it.funderType || ''),
        geographicScope: CoreUtils.cleanString(it.geographicScope || ''),
        explicitWomenSignal: CoreUtils.cleanString(it.explicitWomenSignal || 'Unknown'),
        averageGrantUsd: parseInt(it.averageGrantUsd) || '',
        website: CoreUtils.cleanString(it.website || ''),
        acceptsUnsolicited: CoreUtils.cleanString(it.acceptsUnsolicited || 'Unknown'),
        primaryProgramAreas: CoreUtils.cleanString(it.primaryProgramAreas || ''),
        contactName: CoreUtils.cleanString(it.contactName || ''),
        contactEmail: CoreUtils.cleanString(it.contactEmail || ''),
        contactRole: CoreUtils.cleanString(it.contactRole || ''),
        source: '990 Extract',
        sourceNotes: CoreUtils.cleanString(it.sourceNotes || '')
      })).filter(x => x.funderName);
    } catch (e) {
      Logger.log('❌ 990 parse error: ' + e.message);
      return [];
    }
  },


  _buildEnrichmentPrompt(lead) {
    return `Enrich this funder with public, typical information patterns (do not invent non-public emails).


Return ONLY this JSON (no prose, no markdown):
{
  "contactName": "if commonly public (e.g., program officer)",
  "contactRole": "title",
  "contactEmail": "if generic/public, otherwise empty",
  "acceptsUnsolicited": "Yes | No | Sometimes | Unknown",
  "primaryProgramAreas": "comma-separated",
  "geographicScope": "Local/Regional | State | National | International | Unknown",
  "notes": "1-2 lines including any relationship-first suggestions (events, newsletters, intro paths)"
}


Funder:
- Name: ${lead.funderName}
- Type: ${lead.funderType || 'Unknown'}
- Scope: ${lead.scope || 'Unknown'}
- Website: ${lead.website || 'Unknown'}
- Programs: ${lead.programAreas || 'Unknown'}
- Women/WOC explicit signal: ${lead.explicitWomen || 'Unknown'}`;
  },


  _parseEnrichment(raw) {
    try {
      let txt = typeof raw === 'string' ? raw : JSON.stringify(raw);
      txt = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
      let parsed;
      try { parsed = JSON.parse(txt); }
      catch (e1) {
        const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
        if (a !== -1 && b > a) parsed = JSON.parse(txt.slice(a, b + 1));
        else throw e1;
      }
      return {
        contactName: CoreUtils.cleanString(parsed.contactName || ''),
        contactRole: CoreUtils.cleanString(parsed.contactRole || ''),
        contactEmail: CoreUtils.cleanString(parsed.contactEmail || ''),
        acceptsUnsolicited: CoreUtils.cleanString(parsed.acceptsUnsolicited || 'Unknown'),
        primaryProgramAreas: CoreUtils.cleanString(parsed.primaryProgramAreas || ''),
        geographicScope: CoreUtils.cleanString(parsed.geographicScope || ''),
        notes: CoreUtils.cleanString(parsed.notes || '')
      };
    } catch (e) {
      Logger.log('❌ Enrichment parse error: ' + e.message);
      return {
        contactName: '', contactRole: '', contactEmail: '',
        acceptsUnsolicited: 'Unknown',
        primaryProgramAreas: '', geographicScope: '', notes: ''
      };
    }
  },


  _writeEnrichment(sheet, row, map, d) {
    const updates = {
      'Contact_Person': d.contactName,
      'Contact_Role': d.contactRole,
      'Contact_Email': d.contactEmail,
      'Accepts_Unsolicited': d.acceptsUnsolicited,
      'Primary_Program_Areas': d.primaryProgramAreas,
      'Geographic_Scope': d.geographicScope,
      'Relationship_Notes': d.notes,
      'Last_Updated': new Date()
    };
    Object.keys(updates).forEach(k => {
      const c = map[k];
      if (c !== undefined) sheet.getRange(row, c + 1).setValue(updates[k]);
    });
  },


  _daysSince(d, ref) {
    try { return Math.floor((ref - new Date(d)) / (1000 * 60 * 60 * 24)); } catch (_) { return 9999; }
  },


  _daysUntil(d, ref) {
    try { return Math.ceil((new Date(d) - ref) / (1000 * 60 * 60 * 24)); } catch (_) { return 9999; }
  }
};


// ---------- PUBLIC WRAPPERS (menu handlers) ----------


function setupUnadvertisedFinder() {
  UnadvertisedFinder.setupUnadvertisedFinder();
}


function importFundersFrom990Paste() {
  UnadvertisedFinder.importFundersFrom990Paste();
}


function enrichSelectedLead() {
  UnadvertisedFinder.enrichSelectedLead();
}


function createUnadvertisedWeeklyDigestTrigger() {
  UnadvertisedFinder.createWeeklyDigestTrigger();
}


function deleteUnadvertisedWeeklyDigestTrigger() {
  UnadvertisedFinder.deleteWeeklyDigestTrigger();
}


function unadvertisedWeeklyDigest() {
  UnadvertisedFinder.weeklyDigest();
}
