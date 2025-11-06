"""
Production-ready Grants.gov Scraper
Scrapes grant opportunities and uploads to Google Sheets with comprehensive error handling.
Designed for scheduled/automated execution.
"""

import logging
import os
import sys
import time
import random
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

import requests
from bs4 import BeautifulSoup
from urllib.parse import urlencode
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pandas as pd
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('grant_system.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


# --- CONFIG ---
CONFIG = {
    "base_url": "https://www.grants.gov/search-grants",
    "params": {
        "oppStatuses": os.getenv("OPPORTUNITY_STATUSES", "forecasted,posted"),
        "eligibilities": os.getenv("ELIGIBILITY_CODES", "25,11,99"),
        "sortBy": "closeDate",
        "page": 1
    },
    "max_pages": int(os.getenv("MAX_PAGES", 3)),
    "delay": [
        float(os.getenv("SCRAPE_DELAY_MIN", 3)),
        float(os.getenv("SCRAPE_DELAY_MAX", 6))
    ],
    "google_sheet_name": os.getenv("GOOGLE_SHEET_NAME", "GrantWatch Grants"),
    "credentials_file": os.getenv("GOOGLE_CREDENTIALS_FILE", "grantsgov-integration-298b73eb28d9.json"),
    "headless": os.getenv("HEADLESS_MODE", "True").lower() == "true",
    "timeout": 30
}


# --- BROWSER SETUP ---
def init_browser() -> Optional[webdriver.Chrome]:
    """Initialize headless Chrome driver with proper options."""
    try:
        chrome_options = Options()

        if CONFIG['headless']:
            chrome_options.add_argument('--headless=new')

        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

        driver = webdriver.Chrome(options=chrome_options)
        driver.set_page_load_timeout(CONFIG['timeout'])

        logger.info("Browser initialized successfully")
        return driver
    except Exception as e:
        logger.error(f"Failed to initialize browser: {e}")
        return None


def save_screenshot(driver: webdriver.Chrome, category: str, page_num: int) -> None:
    """Save browser screenshot for debugging."""
    try:
        Path("screenshots").mkdir(exist_ok=True)
        path = f"screenshots/{category}_page{page_num}.png".replace(" ", "_")
        driver.save_screenshot(path)
        logger.debug(f"Screenshot saved: {path}")
    except Exception as e:
        logger.warning(f"Failed to save screenshot: {e}")


def save_html_snapshot(html: str, category: str, page_num: int) -> None:
    """Save HTML for debugging."""
    try:
        Path("html_snapshots").mkdir(exist_ok=True)
        path = f"html_snapshots/{category}_page{page_num}.html".replace(" ", "_")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        logger.debug(f"HTML snapshot saved: {path}")
    except Exception as e:
        logger.warning(f"Failed to save HTML snapshot: {e}")


# --- DATA PARSING ---
def parse_grants(html: str) -> List[Dict]:
    """Parse grant opportunities from HTML."""
    results = []

    try:
        soup = BeautifulSoup(html, "html.parser")
        grant_cards = soup.select(".search-result-card")

        if not grant_cards:
            logger.warning("No grant cards found in HTML")
            return results

        logger.info(f"Found {len(grant_cards)} grant cards")

        for idx, card in enumerate(grant_cards, 1):
            try:
                title_elem = card.select_one(".search-result-title")
                link_elem = card.select_one("a")
                agency_elem = card.select_one(".agency")
                close_date_elem = card.select_one(".closing-date")
                summary_elem = card.select_one(".search-result-summary")
                opp_num_elem = card.select_one(".opp-no")

                # Validate all required fields exist
                if not all([title_elem, link_elem, agency_elem, close_date_elem, summary_elem, opp_num_elem]):
                    logger.debug(f"Skipping card {idx}: missing required fields")
                    continue

                grant = {
                    "Title": title_elem.text.strip(),
                    "Opportunity Number": opp_num_elem.text.strip(),
                    "Agency": agency_elem.text.strip(),
                    "Close Date": close_date_elem.text.strip(),
                    "Summary": summary_elem.text.strip(),
                    "Link": "https://www.grants.gov" + link_elem["href"].strip(),
                    "Scraped At": datetime.now().isoformat()
                }

                results.append(grant)

            except Exception as e:
                logger.warning(f"Failed to parse grant card {idx}: {e}")
                continue

        logger.info(f"Successfully parsed {len(results)} grants")
        return results

    except Exception as e:
        logger.error(f"HTML parsing error: {e}")
        return results


# --- GOOGLE SHEETS ---
def authenticate_sheets() -> Optional[gspread.Client]:
    """Authenticate with Google Sheets API."""
    try:
        if not Path(CONFIG["credentials_file"]).exists():
            logger.error(f"Credentials file not found: {CONFIG['credentials_file']}")
            return None

        scope = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive"
        ]
        creds = ServiceAccountCredentials.from_json_keyfile_name(
            CONFIG["credentials_file"],
            scope
        )
        client = gspread.authorize(creds)
        logger.info("Google Sheets authentication successful")
        return client

    except Exception as e:
        logger.error(f"Google Sheets authentication failed: {e}")
        return None


def upload_to_sheets(client: gspread.Client, data: List[Dict]) -> bool:
    """Upload grant data to Google Sheets."""
    try:
        if not data:
            logger.warning("No data to upload")
            return False

        sheet = client.open(CONFIG["google_sheet_name"])
        worksheet = sheet.worksheet("New_Grants_Imported")

        # Get existing data to avoid duplicates
        existing_records = worksheet.get_all_records()
        existing_opp_numbers = {rec.get("Opportunity Number") for rec in existing_records}

        # Filter out duplicates
        new_grants = [
            g for g in data
            if g["Opportunity Number"] not in existing_opp_numbers
        ]

        if not new_grants:
            logger.info("No new grants to upload (all are duplicates)")
            return True

        # Convert to rows
        df = pd.DataFrame(new_grants)
        rows = [df.columns.values.tolist()] + df.values.tolist()

        # Append to worksheet
        worksheet.append_rows(rows, value_input_option='RAW')

        logger.info(f"Successfully uploaded {len(new_grants)} new grants to Google Sheets")
        return True

    except Exception as e:
        logger.error(f"Failed to upload to Google Sheets: {e}")
        return False


# --- MAIN SCRAPING ---
def scrape_grants() -> List[Dict]:
    """Scrape grants from Grants.gov."""
    all_grants = []
    driver = None

    try:
        driver = init_browser()
        if not driver:
            logger.error("Failed to initialize browser")
            return []

        for page in range(1, CONFIG["max_pages"] + 1):
            try:
                CONFIG["params"]["page"] = page
                url = CONFIG["base_url"] + "?" + urlencode(CONFIG["params"])

                logger.info(f"Scraping page {page}: {url}")

                driver.get(url)

                # Wait for page to load
                try:
                    WebDriverWait(driver, CONFIG['timeout']).until(
                        EC.presence_of_all_elements_located((By.CLASS_NAME, "search-result-card"))
                    )
                except Exception:
                    logger.warning(f"Page {page} took too long to load or no results found")

                time.sleep(random.uniform(*CONFIG["delay"]))

                html = driver.page_source
                save_html_snapshot(html, "GrantsGov", page)
                save_screenshot(driver, "GrantsGov", page)

                grants = parse_grants(html)

                if not grants:
                    logger.info(f"No grants found on page {page}, stopping")
                    break

                all_grants.extend(grants)
                logger.info(f"Page {page}: Found {len(grants)} grants (Total: {len(all_grants)})")

            except Exception as e:
                logger.error(f"Error scraping page {page}: {e}")
                continue

        logger.info(f"Scraping complete. Total grants found: {len(all_grants)}")
        return all_grants

    except Exception as e:
        logger.error(f"Fatal scraping error: {e}")
        return all_grants

    finally:
        if driver:
            try:
                driver.quit()
                logger.info("Browser closed")
            except Exception as e:
                logger.warning(f"Error closing browser: {e}")


# --- MAIN ---
def main():
    """Main entry point."""
    logger.info("=" * 70)
    logger.info("Grant System Scraper Started")
    logger.info("=" * 70)

    try:
        # Scrape grants
        logger.info("Phase 1: Scraping Grants.gov...")
        scraped = scrape_grants()

        if not scraped:
            logger.warning("No grants scraped, exiting")
            return 1

        logger.info(f"Phase 2: Saving {len(scraped)} grants to Excel...")
        df = pd.DataFrame(scraped)
        output_file = f"grantsgov_output_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        df.to_excel(output_file, index=False)
        logger.info(f"Saved to {output_file}")

        # Upload to Google Sheets
        logger.info("Phase 3: Uploading to Google Sheets...")
        client = authenticate_sheets()

        if not client:
            logger.error("Could not authenticate with Google Sheets")
            return 1

        if upload_to_sheets(client, scraped):
            logger.info("Upload successful")
        else:
            logger.error("Upload failed")
            return 1

        logger.info("=" * 70)
        logger.info("Grant System Scraper Completed Successfully")
        logger.info("=" * 70)
        return 0

    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return 2


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
