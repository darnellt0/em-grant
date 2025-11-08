"""
Unit tests for grantsgov_scraper_prod.py
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from grantsgov_scraper_prod import parse_grants, init_browser, cleanup_old_files


class TestParseGrants:
    """Test grant parsing functionality."""

    def test_parse_grants_valid_html(self):
        """Test parsing valid HTML with complete grant data."""
        html = """
        <html>
            <div class="search-result-card">
                <h3 class="search-result-title">Test Grant Title</h3>
                <a href="/view/opp/12345">View Opportunity</a>
                <div class="agency">NASA</div>
                <div class="closing-date">2025-12-31</div>
                <div class="search-result-summary">This is a test grant summary.</div>
                <div class="opp-no">NASA-2025-001</div>
            </div>
        </html>
        """
        results = parse_grants(html)

        assert len(results) == 1
        assert results[0]['Title'] == 'Test Grant Title'
        assert results[0]['Opportunity Number'] == 'NASA-2025-001'
        assert results[0]['Agency'] == 'NASA'
        assert 'Scraped At' in results[0]

    def test_parse_grants_multiple_cards(self):
        """Test parsing HTML with multiple grant cards."""
        html = """
        <html>
            <div class="search-result-card">
                <h3 class="search-result-title">Grant 1</h3>
                <a href="/view/1">Link</a>
                <div class="agency">Agency 1</div>
                <div class="closing-date">2025-12-31</div>
                <div class="search-result-summary">Summary 1</div>
                <div class="opp-no">OPP-001</div>
            </div>
            <div class="search-result-card">
                <h3 class="search-result-title">Grant 2</h3>
                <a href="/view/2">Link</a>
                <div class="agency">Agency 2</div>
                <div class="closing-date">2025-11-30</div>
                <div class="search-result-summary">Summary 2</div>
                <div class="opp-no">OPP-002</div>
            </div>
        </html>
        """
        results = parse_grants(html)

        assert len(results) == 2
        assert results[0]['Opportunity Number'] == 'OPP-001'
        assert results[1]['Opportunity Number'] == 'OPP-002'

    def test_parse_grants_missing_fields(self):
        """Test that grants with missing required fields are skipped."""
        html = """
        <html>
            <div class="search-result-card">
                <h3 class="search-result-title">Incomplete Grant</h3>
                <!-- Missing other required fields -->
            </div>
        </html>
        """
        results = parse_grants(html)

        assert len(results) == 0

    def test_parse_grants_empty_html(self):
        """Test parsing empty HTML."""
        results = parse_grants("")

        assert results == []

    def test_parse_grants_no_cards(self):
        """Test parsing HTML with no grant cards."""
        html = "<html><body><h1>No Results</h1></body></html>"
        results = parse_grants(html)

        assert results == []


class TestBrowserInit:
    """Test browser initialization."""

    @patch('grantsgov_scraper_prod.webdriver.Chrome')
    @patch('grantsgov_scraper_prod.ChromeDriverManager')
    def test_init_browser_success(self, mock_chromedriver, mock_chrome):
        """Test successful browser initialization."""
        mock_driver = Mock()
        mock_chrome.return_value = mock_driver
        mock_chromedriver.return_value.install.return_value = "/path/to/chromedriver"

        driver = init_browser()

        assert driver is not None
        assert mock_driver.set_page_load_timeout.called

    @patch('grantsgov_scraper_prod.webdriver.Chrome')
    @patch('grantsgov_scraper_prod.ChromeDriverManager')
    def test_init_browser_failure(self, mock_chromedriver, mock_chrome):
        """Test browser initialization failure."""
        mock_chrome.side_effect = Exception("ChromeDriver not found")

        driver = init_browser()

        assert driver is None


class TestCleanupOldFiles:
    """Test file cleanup functionality."""

    def test_cleanup_old_files(self, tmp_path):
        """Test that old files are deleted."""
        from datetime import datetime, timedelta
        import time

        # Create test files
        old_file = tmp_path / "old_file.txt"
        new_file = tmp_path / "new_file.txt"

        old_file.write_text("old")
        time.sleep(0.1)
        new_file.write_text("new")

        # Set old file's mtime to 31 days ago
        old_time = (datetime.now() - timedelta(days=31)).timestamp()
        old_file.touch()
        import os
        os.utime(old_file, (old_time, old_time))

        # Run cleanup
        cleanup_old_files(str(tmp_path), days=30, pattern='*.txt')

        # Verify old file deleted, new file remains
        assert not old_file.exists()
        assert new_file.exists()

    def test_cleanup_nonexistent_directory(self):
        """Test cleanup handles non-existent directories gracefully."""
        # Should not raise exception
        cleanup_old_files('/nonexistent/path', days=7)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
