# Grant System - Production Deployment Guide

## System Overview

The Grant System is a Python-based automation suite that:
1. **Scrapes** grant opportunities from Grants.gov
2. **Processes** grant data with deduplication
3. **Uploads** to Google Sheets for centralized tracking
4. **Alerts** stakeholders via email about high-scoring opportunities

### Components

| File | Purpose | Status |
|------|---------|--------|
| `grantsgov_scraper_prod.py` | Production scraper with logging & error handling | ✅ Ready |
| `bridge_upload.py` | Google Sheets upload utility with deduplication | ✅ Ready |
| `email_alerts.py` | Email notification system | ✅ Ready |
| `project_doctor.py` | Automated health checks | ✅ Ready |
| `requirements.txt` | Python dependencies | ✅ Ready |
| `.env.example` | Configuration template | ✅ Ready |

---

## Pre-Deployment Checklist

### 1. Environment Setup

```bash
# Clone/download project
cd "EM Grant"

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Verify installation
python -m pip list
```

### 2. Configuration

```bash
# Copy the environment template
cp .env.example .env

# Edit .env with your values:
# - GOOGLE_CREDENTIALS_FILE: path to your Google service account JSON
# - GOOGLE_SHEET_NAME: your Google Sheet name
# - ALERT_SENDER_EMAIL: Gmail account for alerts
# - ALERT_SENDER_PASSWORD: Gmail app password (NOT your regular password)
# - ALERT_RECIPIENTS: comma-separated email list
# - Other settings as needed
```

### 3. Google Sheets Setup

1. **Create a Google Service Account:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project (or use existing)
   - Enable "Google Sheets API" and "Google Drive API"
   - Create Service Account → Generate JSON key
   - Save JSON file in project root (e.g., `grantsgov-integration-298b73eb28d9.json`)

2. **Share Google Sheet:**
   - Copy the service account email from JSON file
   - Open your "GrantWatch Grants" Google Sheet
   - Share it with the service account email (Editor access)

3. **Prepare Tabs:**
   - Ensure sheet has "New_Grants_Imported" worksheet tab
   - Add headers: `Title`, `Opportunity Number`, `Agency`, `Close Date`, `Summary`, `Link`, `Scraped At`

### 4. Email Alerts Setup (Optional)

For Gmail alerts to work:

1. Enable 2FA on your Gmail account
2. Create an App Password: https://myaccount.google.com/apppasswords
3. Use the App Password in `.env` (NOT your Gmail password)
4. Set `ALERT_SENDER_EMAIL` and `ALERT_SENDER_PASSWORD` in `.env`

---

## Running the System

### Manual Execution

```bash
# Run the production scraper
python grantsgov_scraper_prod.py

# Output:
# - grant_system.log: detailed execution log
# - grantsgov_output_YYYYMMDD_HHMMSS.xlsx: local copy of scraped data
# - Screenshots & HTML snapshots in respective folders
```

### Health Check

```bash
# Verify system is ready before deploying
python project_doctor.py

# Output: System status report with any warnings/failures
```

### Generate Health Report

```bash
# Create JSON health report for monitoring
python project_doctor.py --json health_report.json
```

---

## Automation Setup

### Windows Scheduled Task

1. **Open Task Scheduler** → Create Basic Task
2. **Name:** "Grant System Daily Scrape"
3. **Trigger:** Daily at 7:00 AM (adjust as needed)
4. **Action:**
   - Program: `C:\Python313\python.exe` (your Python path)
   - Arguments: `"C:\Users\darne\OneDrive\Documents\Python Scripts\EM Grant\grantsgov_scraper_prod.py"`
   - Start in: `C:\Users\darne\OneDrive\Documents\Python Scripts\EM Grant`
5. **Options:** Check "Run with highest privileges"

### macOS/Linux Cron Job

```bash
# Edit crontab
crontab -e

# Add this line to run daily at 7:00 AM:
0 7 * * * cd /path/to/EM\ Grant && /path/to/venv/bin/python grantsgov_scraper_prod.py >> /path/to/EM\ Grant/cron.log 2>&1
```

### Docker Deployment (Advanced)

```bash
# Create Dockerfile for containerized execution
docker build -t grant-system .
docker run -e GOOGLE_CREDENTIALS_FILE=/app/credentials.json grant-system
```

---

## Monitoring & Troubleshooting

### Check Logs

```bash
# View real-time logs
tail -f grant_system.log

# On Windows:
type grant_system.log

# Check for errors
grep -i error grant_system.log
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "Credentials file not found" | Verify `GOOGLE_CREDENTIALS_FILE` path in `.env` |
| "Chrome driver not found" | Install: `pip install webdriver-manager` and update imports |
| "No new grants uploaded" | Check if all Opportunity Numbers exist; verify deduplication |
| "Email not sending" | Verify Gmail app password; check SMTP settings |
| "Page load timeout" | Increase `timeout` in config; check Grants.gov website status |

### Health Check Exit Codes

```
0 = All systems nominal
1 = Warnings present (non-blocking)
2 = Critical failures detected (action required)
```

---

## Security Hardening

### Before Production Deployment

1. **Never commit secrets:**
   ```bash
   # Verify .env is in .gitignore
   echo ".env" >> .gitignore
   echo "*.json" >> .gitignore
   echo "grantsgov_output_*.xlsx" >> .gitignore
   ```

2. **Use environment variables only:**
   - All sensitive config goes in `.env` (local file)
   - Pass to scripts via `os.getenv()`
   - Never hardcode credentials

3. **Rotate credentials periodically:**
   - Google Service Account keys: Rotate every 90 days
   - Gmail App Passwords: Update if exposed

4. **Run health check regularly:**
   ```bash
   # Weekly
   python project_doctor.py >> health_checks.log
   ```

5. **Monitor logs for anomalies:**
   - Failed authentications
   - Parse errors
   - Unusual data patterns

---

## Performance Optimization

### Reduce Scraping Time

```python
# In .env, adjust delay and pages:
SCRAPE_DELAY_MIN=1        # Minimum wait (seconds)
SCRAPE_DELAY_MAX=2        # Maximum wait (seconds)
MAX_PAGES=1               # Start with 1 page, increase gradually
```

### Handle Large Datasets

```python
# If > 10,000 grants per run:
# - Split into multiple sheets
# - Archive old data to separate tabs
# - Use batch API calls instead of append_rows()
```

---

## Rollback & Recovery

### If Scraper Fails Mid-Run

1. Check the Excel output file (`grantsgov_output_*.xlsx`)
2. Manually upload from the file if needed
3. Check logs for error cause
4. Fix config or code
5. Re-run: `python grantsgov_scraper_prod.py`

### If Data Gets Corrupted

1. Check "New_Grants_Imported" tab in Google Sheet
2. Review recent changes in Google Sheets version history
3. Restore from backup if available
4. Verify deduplication logic in next run

---

## Support & Debugging

### Run in Debug Mode

Add this to `grantsgov_scraper_prod.py`:

```python
# Change log level
logging.basicConfig(level=logging.DEBUG)  # Shows all detail

# Run with verbose output
python grantsgov_scraper_prod.py
```

### Generate Detailed Report

```bash
python project_doctor.py --fix > deploy_report.txt 2>&1
```

### Test Components Individually

```bash
# Test Google Sheets connection
python -c "from bridge_upload import authenticate_sheets; print(authenticate_sheets())"

# Test data parsing
python -c "from grantsgov_scraper_prod import parse_grants; print(parse_grants('<html>...</html>'))"

# Test email alerts
python -c "from email_alerts import send_high_scoring_grants_alert; send_high_scoring_grants_alert(...)"
```

---

## Post-Deployment Checklist

- [ ] All dependencies installed without errors
- [ ] `.env` file created and configured
- [ ] Google Sheets sheet prepared with headers
- [ ] Google Service Account credentials working
- [ ] First manual run completed successfully
- [ ] Output verified in Google Sheets
- [ ] Logs checked for warnings/errors
- [ ] Scheduled task/cron job created
- [ ] Health check passes: `python project_doctor.py`
- [ ] Email alerts tested (if using)
- [ ] Backup/recovery plan documented

---

## Production SLAs

| Metric | Target | Current |
|--------|--------|---------|
| Uptime | 99% | Pending |
| Scraping Latency | < 5 min | ~2-3 min (3 pages) |
| Data Freshness | < 24 hours | Daily run |
| Alert Response | < 30 min | Varies (email dependent) |

---

## Contact & Documentation

- **Project:** Elevated Movements Grant System
- **Maintainer:** DevOps/DX Team
- **Status:** Production Ready ✅
- **Last Updated:** 2025-10-24
