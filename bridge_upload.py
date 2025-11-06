import pandas as pd
import gspread
from oauth2client.service_account import ServiceAccountCredentials

def upload_grants_to_sheets(file_path, sheet_name, tab_name, creds_file):
    scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
    creds = ServiceAccountCredentials.from_json_keyfile_name(creds_file, scope)
    client = gspread.authorize(creds)

    if file_path.endswith('.xlsx'):
        df = pd.read_excel(file_path, sheet_name=tab_name)
    else:
        df = pd.read_csv(file_path)

    sheet = client.open(sheet_name)
    try:
        worksheet = sheet.worksheet(tab_name)
        existing_data = worksheet.get_all_records()
        existing_df = pd.DataFrame(existing_data)
    except gspread.exceptions.WorksheetNotFound:
        worksheet = sheet.add_worksheet(title=tab_name, rows="100", cols="20")
        existing_df = pd.DataFrame()

    if 'Opportunity Number' in df.columns and 'Opportunity Number' in existing_df.columns:
        new_df = df[~df['Opportunity Number'].isin(existing_df['Opportunity Number'])]
    else:
        new_df = df

    if not new_df.empty:
        combined_df = pd.concat([existing_df, new_df], ignore_index=True)
        worksheet.clear()
        worksheet.update([combined_df.columns.values.tolist()] + combined_df.values.tolist())
        print(f"✅ Uploaded {len(new_df)} new grants to '{tab_name}'")
    else:
        print("📭 No new grants to upload")
