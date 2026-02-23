//Module3_DateUtils.gs
const DateUtils = {
  NON_DATE_DEADLINES: ['ongoing', 'rolling', 'tbd', 'varies', 'continuous', 'open', 'check website'],
 
  isSpecialDeadline(deadline) {
    if (!deadline) return false;
    return this.NON_DATE_DEADLINES.includes(deadline.toString().toLowerCase().trim());
  },
 
  parseDeadline(deadlineValue) {
    if (!deadlineValue) return { type: 'empty', value: null };
   
    const deadlineStr = deadlineValue.toString().toLowerCase().trim();
   
    if (this.isSpecialDeadline(deadlineStr)) {
      return { type: 'special', value: deadlineStr };
    }
   
    try {
      const parsed = new Date(deadlineValue);
      if (isNaN(parsed.getTime())) {
        return { type: 'invalid', value: deadlineStr };
      }
      return { type: 'date', value: parsed };
    } catch (error) {
      return { type: 'invalid', value: deadlineStr };
    }
  },
 
  calculateDaysLeft(deadlineValue) {
    const parsedDeadline = this.parseDeadline(deadlineValue);
   
    if (parsedDeadline.type !== 'date') {
      return parsedDeadline.value || 'TBD';
    }
   
    const today = new Date();
    const diffTime = parsedDeadline.value - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
   
    return diffDays > 0 ? diffDays : 'Expired';
  },
 
  formatDateForSheet(date) {
    if (!date) return '';
    if (typeof date === 'string') return date;
    return Utilities.formatDate(date, Session.getScriptTimeZone(), "MM/dd/yyyy");
  }
};
