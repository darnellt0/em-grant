import requests, os, time, random
from bs4 import BeautifulSoup
from urllib.parse import urlencode
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from bridge_upload import upload_grants_to_sheets
import pandas as pd

# --- CONFIG ---
CONFIG = {
    "base_url": "https://www.grants.gov/search-grants",
    "params": {
        "oppStatuses": "forecasted,posted",  # Only open/posted opportunities
        "eligibilities": "25,11,99",         # Small businesses, nonprofits, individuals
        "sortBy": "closeDate",
        "page": 1
    },
    "max_pages": 3,
    "delay": [3, 6],
    "google_sheet_name": "GrantWatch Grants",
    "credentials_file": "grantsgov-integration-298b73eb28d9.json",  # Replace with your actual file
    "headless": True
}

# --- SCREENSHOT SETUP ---
def init_browser():
    chrome_options = Options()
    if CONFIG['headless']:
        chrome_options.add_argument('--headless=new')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    driver = webdriver.Chrome(options=chrome_options)
    return driver

def save_screenshot(driver, category, page_num):
    os.makedirs("screenshots", exist_ok=True)
    path = f"screenshots/{category}_page{page_num}.png".replace(" ", "_")
    driver.save_screenshot(path)
    print(f"📸 Screenshot saved: {path}")

def save_html_snapshot(html, category, page_num):
    os.makedirs("html_snapshots", exist_ok=True)
    path = f"html_snapshots/{category}_page{page_num}.html".replace(" ", "_")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"🗂️ HTML snapshot saved: {path}")

# --- DATA PARSING ---
def parse_grants(html):
    soup = BeautifulSoup(html, "html.parser")
    grant_cards = soup.select(".search-result-card")
    results = []

    for card in grant_cards:
        try:
            title = card.select_one(".search-result-title").text.strip()
            link = "https://www.grants.gov" + card.select_one("a")["href"].strip()
            agency = card.select_one(".agency").text.strip()
            close_date = card.select_one(".closing-date").text.strip()
            summary = card.select_one(".search-result-summary").text.strip()
            opp_number = card.select_one(".opp-no").text.strip()

            results.append({
                "Title": title,
                "Opportunity Number": opp_number,
                "Agency": agency,
                "Close Date": close_date,
                "Summary": summary,
                "Link": link
            })
        except Exception as e:
            print(f"⚠️ Failed to parse one grant: {e}")
            continue
    return results

# --- MAIN ---
def scrape_grants():
    all_grants = []
    driver = init_browser()

    for page in range(1, CONFIG["max_pages"] + 1):
        CONFIG["params"]["page"] = page
        url = CONFIG["base_url"] + "?" + urlencode(CONFIG["params"])
        print(f"🌐 Visiting: {url}")

        driver.get(url)
        time.sleep(random.uniform(*CONFIG["delay"]))

        html = driver.page_source
        save_html_snapshot(html, "GrantsGov", page)
        save_screenshot(driver, "GrantsGov", page)

        grants = parse_grants(html)
        if not grants:
            print("🚫 No grants found on this page.")
            break
        all_grants.extend(grants)

    driver.quit()
    return all_grants

# --- RUN ---
if __name__ == "__main__":
    print("🚀 Scraping Grants.gov...")
    scraped = scrape_grants()
    print(f"✅ Total grants found: {len(scraped)}")

    if scraped:
        # Save to file and upload to Google Sheets
        df = pd.DataFrame(scraped)
        df.to_excel("grantsgov_output.xlsx", index=False)

        upload_grants_to_sheets(
            file_path="grantsgov_output.xlsx",
            sheet_name=CONFIG["google_sheet_name"],
            tab_name="New_Grants_Imported",
            creds_file=CONFIG["credentials_file"]
        )
