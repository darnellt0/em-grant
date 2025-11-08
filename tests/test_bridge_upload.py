"""
Unit tests for bridge_upload.py
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
import sys
import pandas as pd

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from bridge_upload import upload_grants_to_sheets


class TestBridgeUpload:
    """Test Google Sheets upload functionality."""

    @patch('bridge_upload.gspread.authorize')
    @patch('bridge_upload.Credentials.from_service_account_file')
    def test_upload_grants_file_not_found(self, mock_creds, mock_auth):
        """Test error handling when file doesn't exist."""
        with pytest.raises(FileNotFoundError):
            upload_grants_to_sheets(
                '/nonexistent/file.xlsx',
                'Test Sheet',
                'Test Tab',
                'credentials.json'
            )

    @patch('bridge_upload.Path.exists')
    @patch('bridge_upload.gspread.authorize')
    @patch('bridge_upload.Credentials.from_service_account_file')
    def test_upload_grants_credentials_not_found(self, mock_creds, mock_auth, mock_path_exists):
        """Test error handling when credentials file doesn't exist."""
        # File exists but credentials don't
        mock_path_exists.side_effect = lambda: False

        with pytest.raises(FileNotFoundError):
            upload_grants_to_sheets(
                'test.xlsx',
                'Test Sheet',
                'Test Tab',
                '/nonexistent/credentials.json'
            )

    @patch('bridge_upload.pd.read_excel')
    @patch('bridge_upload.gspread.authorize')
    @patch('bridge_upload.Credentials.from_service_account_file')
    @patch('bridge_upload.Path.exists')
    def test_upload_grants_creates_worksheet_if_not_exists(
        self, mock_exists, mock_creds, mock_auth, mock_read_excel
    ):
        """Test that worksheet is created if it doesn't exist."""
        mock_exists.return_value = True

        # Mock credentials and client
        mock_client = Mock()
        mock_auth.return_value = mock_client

        # Mock sheet and worksheet
        mock_sheet = Mock()
        mock_client.open.return_value = mock_sheet

        # Worksheet doesn't exist initially
        import gspread.exceptions
        mock_sheet.worksheet.side_effect = gspread.exceptions.WorksheetNotFound("Not found")

        mock_worksheet = Mock()
        mock_worksheet.get_all_values.return_value = []
        mock_sheet.add_worksheet.return_value = mock_worksheet

        # Mock DataFrame
        test_data = pd.DataFrame({
            'Title': ['Test Grant'],
            'Opportunity Number': ['TEST-001']
        })
        mock_read_excel.return_value = test_data

        # Call function
        upload_grants_to_sheets(
            'test.xlsx',
            'Test Sheet',
            'Test Tab',
            'credentials.json'
        )

        # Verify worksheet was created with correct parameters (integers not strings)
        mock_sheet.add_worksheet.assert_called_once()
        call_kwargs = mock_sheet.add_worksheet.call_args[1]
        assert isinstance(call_kwargs['rows'], int)
        assert isinstance(call_kwargs['cols'], int)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
