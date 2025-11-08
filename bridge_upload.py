import json
import logging
from datetime import datetime
from pathlib import Path
import pandas as pd
import gspread
from google.oauth2.service_account import Credentials
from tenacity import retry, stop_after_attempt, wait_exponential

# Setup logger
logger = logging.getLogger(__name__)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def upload_grants_to_sheets(file_path, sheet_name, tab_name, creds_file):
    """
    Upload grants from local file to Google Sheets with deduplication and backup.

    Args:
        file_path (str): Path to Excel/CSV file containing grants
        sheet_name (str): Name of Google Sheet to upload to
        tab_name (str): Worksheet tab name
        creds_file (str): Path to Google service account JSON credentials

    Raises:
        FileNotFoundError: If file or credentials not found
        gspread.exceptions.SpreadsheetNotFound: If Google Sheet doesn't exist
    """
    # Validate inputs
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    creds_path = Path(creds_file)
    if not creds_path.exists():
        raise FileNotFoundError(f"Credentials file not found: {creds_file}")

    # Authenticate with Google Sheets using modern google-auth
    scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
    ]
    creds = Credentials.from_service_account_file(creds_file, scopes=scopes)
    client = gspread.authorize(creds)

    # Read input file
    if file_path.suffix == '.xlsx':
        df = pd.read_excel(file_path, sheet_name=tab_name)
    else:
        df = pd.read_csv(file_path)

    logger.info(f"Read {len(df)} grants from {file_path}")

    # Open Google Sheet
    sheet = client.open(sheet_name)

    # Get or create worksheet
    try:
        worksheet = sheet.worksheet(tab_name)
        existing_data = worksheet.get_all_records()
        existing_df = pd.DataFrame(existing_data)
        logger.info(f"Found existing worksheet '{tab_name}' with {len(existing_df)} records")
    except gspread.exceptions.WorksheetNotFound:
        # Fixed: rows and cols must be integers, not strings
        worksheet = sheet.add_worksheet(title=tab_name, rows=100, cols=20)
        existing_df = pd.DataFrame()
        logger.info(f"Created new worksheet '{tab_name}'")

    # Deduplication logic
    if 'Opportunity Number' in df.columns and 'Opportunity Number' in existing_df.columns:
        new_df = df[~df['Opportunity Number'].isin(existing_df['Opportunity Number'])]
        logger.info(f"Filtered {len(df) - len(new_df)} duplicates")
    else:
        new_df = df
        logger.warning("Opportunity Number column not found, uploading all records")

    if not new_df.empty:
        combined_df = pd.concat([existing_df, new_df], ignore_index=True)

        # BACKUP before clearing (critical safety measure)
        backup_dir = Path("backups")
        backup_dir.mkdir(exist_ok=True)
        backup_file = backup_dir / f"backup_{tab_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        backup_data = worksheet.get_all_values()
        with open(backup_file, 'w') as f:
            json.dump(backup_data, f)
        logger.info(f"Backup saved: {backup_file}")

        # Clear and update
        worksheet.clear()
        worksheet.update([combined_df.columns.values.tolist()] + combined_df.values.tolist())
        logger.info(f"Uploaded {len(new_df)} new grants to '{tab_name}'")
    else:
        logger.info("No new grants to upload (all duplicates)")
