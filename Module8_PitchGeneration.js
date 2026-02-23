//Module8_PitchGeneration.gs
const PitchGeneration = {
 
  generatePitches() {
    const ui = SpreadsheetApp.getUi();
   
    const response = ui.alert('Generate Grant Pitches',
      'This will generate AI-powered pitches for grants marked "Ready for Pitch".\n\n' +
      '✨ AI-generated pitches\n' +
      '📝 Customized for each grant\n' +
      '⏱️ Estimated time: 2-3 minutes\n\n' +
      'Continue?',
      ui.ButtonSet.YES_NO);
   
    if (response !== ui.Button.YES) return;
   
    try {
      const grantsSheet = CoreUtils.getSheetSafely(GRANT_CONFIG.SHEETS.GRANTS);
      const promptSheet = CoreUtils.getSheetSafely(GRANT_CONFIG.SHEETS.PROMPT_TEMPLATES);
     
      // Get prompt template
      const template = promptSheet.getRange('A1').getValue();
      if (!template) {
        ui.alert('No Template Found',
          'No prompt template found. Please set up a template first.',
          ui.ButtonSet.OK);
        return;
      }
     
      // Get grants ready for pitches
      const data = grantsSheet.getDataRange().getValues();
      const headers = data[0];
      const columnMap = CoreUtils.createColumnMapping(grantsSheet);
     
      const grantsForPitch = data.slice(1).filter(row =>
        row[columnMap['Status']] === 'Ready for Pitch' &&
        !row[columnMap['Draft_Pitch']]
      );
     
      if (grantsForPitch.length === 0) {
        ui.alert('No Grants Ready',
          'No grants found with status "Ready for Pitch" that need pitches.\n\n' +
          'Update grant statuses and try again.',
          ui.ButtonSet.OK);
        return;
      }
     
      ui.alert('Pitch Generation Started',
        `Generating pitches for ${grantsForPitch.length} grants...\n\nThis may take several minutes.`,
        ui.ButtonSet.OK);
     
      let successCount = 0;
      let errorCount = 0;
     
      for (let i = 0; i < grantsForPitch.length; i++) {
        const grant = grantsForPitch[i];
        const grantData = this.extractGrantDataForPitch(grant, columnMap);
       
        try {
          const pitchResult = this.generateSinglePitch(grantData, template);
         
          if (pitchResult.success) {
            const rowIndex = data.findIndex(row => row[0] === grant[0]) + 1;
            this.updateGrantWithPitch(grantsSheet, rowIndex, pitchResult.data, columnMap);
            successCount++;
            Logger.log(`✅ Generated pitch for: ${grantData.grantName}`);
          } else {
            errorCount++;
            Logger.log(`❌ Pitch generation failed for: ${grantData.grantName}`);
          }
         
          // Delay between requests
          if (i < grantsForPitch.length - 1) {
            Utilities.sleep(3000);
          }
         
        } catch (error) {
          errorCount++;
          Logger.log(`❌ Exception generating pitch for ${grantData.grantName}: ${error.message}`);
        }
      }
     
      ui.alert('✅ Pitch Generation Complete!',
        `Pitch generation completed!\n\n` +
        `• ${successCount} pitches successfully generated\n` +
        `• ${errorCount} pitches had generation errors\n\n` +
        `Check Draft_Pitch column for results!`,
        ui.ButtonSet.OK);
       
      CoreUtils.logSystemEvent('Pitch Generation', 'Success', `Generated ${successCount} pitches`);
     
    } catch (error) {
      Logger.log(`❌ Pitch generation error: ${error.message}`);
      ui.alert('❌ Pitch Generation Error', `Pitch generation failed: ${error.message}`, ui.ButtonSet.OK);
    }
  },


  extractGrantDataForPitch(grantRow, columnMap) {
    return {
      grantName: grantRow[columnMap['Grant_Name']] || 'Unknown Grant',
      sponsorOrg: grantRow[columnMap['Sponsor_Org']] || 'Unknown Organization',
      amount: grantRow[columnMap['Amount']] || 'TBD',
      focusArea: grantRow[columnMap['Focus_Area']] || 'Community Development',
      deadline: grantRow[columnMap['Deadline (Est.)']] || 'TBD',
      daysLeft: DateUtils.calculateDaysLeft(grantRow[columnMap['Deadline (Est.)']]), // ✅ ADD THIS LINE
      eligibility: grantRow[columnMap['Eligibility Summary']] || 'Review requirements',
      notes: grantRow[columnMap['Notes']] || ''
    };
  },


  generateSinglePitch(grantData, template) {
    try {
      // Replace template variables
      let customizedPrompt = template
        .replace(/\{\{Grant_Name\}\}/g, grantData.grantName)
        .replace(/\{\{Sponsor_Org\}\}/g, grantData.sponsorOrg)
        .replace(/\{\{Amount\}\}/g, grantData.amount)
        .replace(/\{\{Focus_Area\}\}/g, grantData.focusArea)
        .replace(/\{\{Deadline \(Est\.\)\}\}/g, grantData.deadline)
        .replace(/\{\{Days_Left\}\}/g, grantData.daysLeft || 'TBD')
        .replace(/\{\{Eligibility_Summary\}\}/g, grantData.eligibility)
        .replace(/\{\{Notes\}\}/g, grantData.notes);


      // Add specific instructions
      customizedPrompt += `\n\nADDITIONAL CONTEXT:
- Keep pitch professional but warm
- Emphasize measurable community impact
- Highlight Shria's expertise and leadership
- Address grant requirements specifically
- Include call to action
- Maximum 3 paragraphs


Generate a compelling, personalized pitch now.`;


      const response = APIUtils.callOpenAI(customizedPrompt, {
        temperature: 0.7,
        maxTokens: 800
      });
     
      if (response.success) {
        const pitch = this.cleanAndFormatPitch(response.data);
        return { success: true, data: pitch };
      } else {
        return { success: false, error: response.error };
      }
     
    } catch (error) {
      return { success: false, error: error.message };
    }
  },


  cleanAndFormatPitch(pitchText) {
    // Clean up the pitch text
    let cleaned = pitchText.trim();
   
    // Remove any JSON formatting if present
    if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
      try {
        const parsed = JSON.parse(cleaned);
        cleaned = parsed.pitch || parsed.content || cleaned;
      } catch (e) {
        // Not JSON, continue with original text
      }
    }
   
    // Remove markdown formatting
    cleaned = cleaned.replace(/\*\*/g, '');
    cleaned = cleaned.replace(/\*/g, '');
    cleaned = cleaned.replace(/#{1,6}\s/g, '');
   
    // Ensure proper paragraph spacing
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
   
    // Remove excessive spaces
    cleaned = cleaned.replace(/[ ]{2,}/g, ' ');
   
    return cleaned.trim();
  },


  updateGrantWithPitch(sheet, rowNumber, pitch, columnMap) {
    try {
      const draftPitchCol = columnMap['Draft_Pitch'];
      if (draftPitchCol !== undefined) {
        sheet.getRange(rowNumber, draftPitchCol + 1).setValue(pitch);
      }
     
      // Update status to indicate pitch is ready
      const statusCol = columnMap['Status'];
      if (statusCol !== undefined) {
        sheet.getRange(rowNumber, statusCol + 1).setValue('Pitch Generated');
      }
     
      // Update timestamp
      const lastUpdatedCol = columnMap['Last_Updated'];
      if (lastUpdatedCol !== undefined) {
        sheet.getRange(rowNumber, lastUpdatedCol + 1).setValue(new Date());
      }
     
      return true;
     
    } catch (error) {
      Logger.log(`❌ Error updating grant with pitch: ${error.message}`);
      return false;
    }
  },


  generateCustomPitch() {
    const ui = SpreadsheetApp.getUi();
   
    // Get grant selection
    const grantResponse = ui.prompt(
      'Custom Pitch Generation',
      'Enter the exact Grant Name you want to generate a pitch for:',
      ui.ButtonSet.OK_CANCEL
    );
   
    if (grantResponse.getSelectedButton() !== ui.Button.OK) return;
   
    const grantName = grantResponse.getResponseText().trim();
    if (!grantName) {
      ui.alert('No Grant Name', 'Please enter a grant name.', ui.ButtonSet.OK);
      return;
    }
   
    try {
      const grantsSheet = CoreUtils.getSheetSafely(GRANT_CONFIG.SHEETS.GRANTS);
      const data = grantsSheet.getDataRange().getValues();
      const columnMap = CoreUtils.createColumnMapping(grantsSheet);
     
      // Find the grant
      const grantRow = data.find(row =>
        row[0] && row[0].toString().toLowerCase().includes(grantName.toLowerCase())
      );
     
      if (!grantRow) {
        ui.alert('Grant Not Found',
          `No grant found matching "${grantName}".`,
          ui.ButtonSet.OK);
        return;
      }
     
      const grantData = this.extractGrantDataForPitch(grantRow, columnMap);
     
      // Get custom template or use default
      const templateResponse = ui.prompt(
        'Custom Template (Optional)',
        'Enter custom prompt template or leave empty for default:',
        ui.ButtonSet.OK_CANCEL
      );
     
      let template;
      if (templateResponse.getSelectedButton() === ui.Button.OK && templateResponse.getResponseText().trim()) {
        template = templateResponse.getResponseText().trim();
      } else {
        const promptSheet = CoreUtils.getSheetSafely(GRANT_CONFIG.SHEETS.PROMPT_TEMPLATES);
        template = promptSheet.getRange('A1').getValue();
      }
     
      ui.alert('Generating Pitch',
        `Generating custom pitch for: ${grantData.grantName}\n\nThis may take 1-2 minutes.`,
        ui.ButtonSet.OK);
     
      const pitchResult = this.generateSinglePitch(grantData, template);
     
      if (pitchResult.success) {
        const rowIndex = data.findIndex(row => row[0] === grantRow[0]) + 1;
        this.updateGrantWithPitch(grantsSheet, rowIndex, pitchResult.data, columnMap);
       
        ui.alert('✅ Pitch Generated!',
          `Custom pitch generated successfully!\n\nCheck the Draft_Pitch column for: ${grantData.grantName}`,
          ui.ButtonSet.OK);
         
        CoreUtils.logSystemEvent('Custom Pitch', 'Success', `Generated for ${grantData.grantName}`);
      } else {
        ui.alert('❌ Generation Failed',
          `Failed to generate pitch: ${pitchResult.error}`,
          ui.ButtonSet.OK);
      }
     
    } catch (error) {
      Logger.log(`❌ Custom pitch error: ${error.message}`);
      ui.alert('❌ Error', `Custom pitch generation failed: ${error.message}`, ui.ButtonSet.OK);
    }
  },


  setupPitchTemplate() {
    const ui = SpreadsheetApp.getUi();
   
    const response = ui.prompt(
      'Setup Pitch Template',
      'Enter your custom pitch template.\n\nUse these variables:\n' +
      '{{Grant_Name}} {{Sponsor_Org}} {{Amount}} {{Focus_Area}} {{Deadline (Est.)}}\n\n' +
      'Current template will be replaced:',
      ui.ButtonSet.OK_CANCEL
    );
   
    if (response.getSelectedButton() === ui.Button.OK) {
      const newTemplate = response.getResponseText().trim();
     
      if (newTemplate) {
        try {
          const promptSheet = CoreUtils.getSheetSafely(GRANT_CONFIG.SHEETS.PROMPT_TEMPLATES);
          promptSheet.getRange('A1').setValue(newTemplate);
         
          ui.alert('✅ Template Updated!',
            'Pitch template has been updated successfully!',
            ui.ButtonSet.OK);
           
          CoreUtils.logSystemEvent('Template Update', 'Success', 'Pitch template updated');
        } catch (error) {
          ui.alert('❌ Update Failed',
            `Failed to update template: ${error.message}`,
            ui.ButtonSet.OK);
        }
      } else {
        ui.alert('No Template',
          'No template provided. Template not updated.',
          ui.ButtonSet.OK);
      }
    }
  }
};
