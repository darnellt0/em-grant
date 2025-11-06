# Elevated Movements Grant Tracking System

Automated federal grant opportunity discovery and tracking system that scrapes Grants.gov and syncs to Google Sheets.

## Recent Improvements (2025-11-06)

- ✅ Migrated from deprecated `oauth2client` to modern `google-auth` library
- ✅ Added automatic `.env` file loading with `python-dotenv`
- ✅ Fixed duplicate column headers in Google Sheets uploads
- ✅ Added retry logic with exponential backoff for API rate limiting
- ✅ Integrated optional email alerts into main workflow
- ✅ Made worksheet name configurable via environment variables

## 1. SETUP

Install Python packages:
```bash
pip install -r requirements.txt
```

Create your `.env` file from the template:
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

Place your Google Service Account credentials JSON file in this folder.

## 2. USAGE

### Quick Start

Run the production scraper:
```bash
python grantsgov_scraper_prod.py
```

This will:
1. Scrape grant opportunities from Grants.gov
2. Save results to a timestamped Excel file
3. Upload new grants to Google Sheets (with deduplication)
4. Send email alerts for high-value opportunities (if configured)

### Manual Bridge Upload (Legacy)

You can also manually upload Excel files:

```python
from bridge_upload import upload_grants_to_sheets

upload_grants_to_sheets(
    file_path='grantsgov_output.xlsx',
    sheet_name='GrantWatch Grants',
    tab_name='New_Grants_Imported',
    creds_file='credentials.json'
)
```

## 3. TRIGGER IMPORT INTO Apps Script

Open the Grant Tracker Google Sheet and click menu: **Grant System > Import From Python Bridge**

Or, deploy as Web App and call from Python:

```python
import requests
requests.get("https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec")
```

## 4. OPTIONAL: EMAIL ALERT

Call this separately if needed:

```python
from email_alerts import send_high_scoring_grants_alert

send_high_scoring_grants_alert(
    file_path='grantsgov_output.xlsx',
    tab_name='New_Grants',
    threshold=80,
    sender='your_email@gmail.com',
    password='your_app_password',
    recipients=['shria@elevated-movements.com']
)
```
