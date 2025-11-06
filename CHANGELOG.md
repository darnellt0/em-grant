# Changelog

All notable changes to the EM Grant System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-11-06

### Added
- Retry logic with exponential backoff for Google Sheets API calls to handle rate limiting
- Automatic `.env` file loading using `python-dotenv` library
- Email alerts integrated into main workflow (Phase 4) as optional, non-fatal feature
- `GOOGLE_WORKSHEET_NAME` environment variable for configurable worksheet names
- Comprehensive inline documentation and code comments
- CHANGELOG.md to track version history

### Changed
- **BREAKING:** Migrated from deprecated `oauth2client` to modern `google-auth` library
  - Updated `requirements.txt` to use `google-auth>=2.17.0`
  - Modified `authenticate_sheets()` function to use `google.oauth2.service_account.Credentials`
- Improved `.env.example` with clearer comments and examples
- Enhanced README.md with recent improvements section and better usage instructions
- Made worksheet name configurable instead of hardcoded value

### Fixed
- Duplicate column headers being appended to Google Sheets on every upload
- Missing explicit environment variable loading (now uses `load_dotenv()`)
- Hardcoded worksheet name "New_Grants_Imported" now configurable via environment

### Security
- Removed deprecated `oauth2client` library (no longer maintained)
- Updated to modern Google authentication library with better security practices

### Documentation
- Updated README.md with recent improvements and better quick start guide
- Enhanced .env.example with detailed comments for each configuration parameter
- Added this CHANGELOG.md for version tracking

## [1.0.0] - 2025-10-24

### Added
- Initial production-ready release
- Grants.gov web scraper with Selenium
- Google Sheets integration with deduplication
- Excel export functionality
- Email alerts for high-value grants
- Comprehensive logging and error handling
- Health check utility (project_doctor.py)
- Extensive documentation (README, SYSTEM_ANALYSIS, PRODUCTION_GUIDE, PROJECT_STATUS)

### Features
- Multi-page pagination support
- Anti-bot countermeasures (random delays, user-agent spoofing)
- Configurable eligibility filters
- Screenshot and HTML snapshot debugging
- OAuth2 service account authentication
- Automated scheduling support (cron/Task Scheduler)

---

## Migration Guide (v1.0.0 to v1.1.0)

### Required Actions

1. **Update Dependencies**
   ```bash
   pip install -r requirements.txt
   ```
   This will install the new `google-auth` library and remove `oauth2client`.

2. **Update .env File**
   Add the new `GOOGLE_WORKSHEET_NAME` variable to your `.env`:
   ```bash
   GOOGLE_WORKSHEET_NAME=New_Grants_Imported
   ```

3. **No Code Changes Required**
   All changes are backward compatible. Your existing `.env` file will continue to work.

### Optional Actions

- Review and update email alert configuration in `.env` for the new integrated workflow
- Test the new retry logic by monitoring logs for rate limiting messages

### Breaking Changes

- If you were directly importing `oauth2client` in custom code, you'll need to update to `google-auth`
- The `authenticate_sheets()` function signature remains the same but uses different underlying library

---

## Support

For issues or questions about this release:
- Review the updated documentation in `README.md`
- Check `SYSTEM_ANALYSIS.md` for technical details
- Consult `PRODUCTION_GUIDE.md` for deployment instructions
