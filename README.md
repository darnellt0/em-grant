# Elevated Movements Python ↔ Google Sheets Bridge

This bundle connects your Python scraper output to your Google Sheets-based Apps Script system.

## 1. SETUP

Install Python packages:
```bash
pip install pandas gspread oauth2client openpyxl
```

Place your `credentials.json` file in this folder.

## 2. PYTHON USAGE

From your main scraper script, call:

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
