import os
import ssl
import logging
from pathlib import Path
import pandas as pd
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logger
logger = logging.getLogger(__name__)

def send_high_scoring_grants_alert(
    file_path,
    tab_name=None,
    threshold=None,
    sender=None,
    password=None,
    recipients=None
):
    """
    Send email alert for high-scoring grant opportunities.

    Args:
        file_path (str): Path to Excel file with grants
        tab_name (str, optional): Sheet name to read. Defaults to env var or 'New_Grants'
        threshold (int, optional): Relevance score threshold. Defaults to env var or 80
        sender (str, optional): Sender email. Defaults to env var ALERT_SENDER_EMAIL
        password (str, optional): Email password. Defaults to env var ALERT_SENDER_PASSWORD
        recipients (list, optional): List of recipient emails. Defaults to env var ALERT_RECIPIENTS

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        # Load from environment variables if not provided
        sender = sender or os.getenv("ALERT_SENDER_EMAIL")
        password = password or os.getenv("ALERT_SENDER_PASSWORD")
        recipients_str = os.getenv("ALERT_RECIPIENTS", "")
        recipients = recipients or (recipients_str.split(",") if recipients_str else [])
        threshold = threshold or int(os.getenv("RELEVANCE_SCORE_THRESHOLD", "80"))
        tab_name = tab_name or "New_Grants"
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))

        # Validate required parameters
        if not sender or not password:
            logger.error("Email sender credentials not configured. Set ALERT_SENDER_EMAIL and ALERT_SENDER_PASSWORD")
            return False

        if not recipients:
            logger.error("No recipients configured. Set ALERT_RECIPIENTS")
            return False

        # Validate file exists
        file_path = Path(file_path)
        if not file_path.exists():
            logger.error(f"File not found: {file_path}")
            return False

        # Read data
        df = pd.read_excel(file_path, sheet_name=tab_name)

        # Check if Relevance Score column exists
        if 'Relevance Score' not in df.columns:
            logger.warning(
                "Relevance Score column not found in data. "
                "Email alerts require manual addition of this column. Skipping alert."
            )
            return False

        # Filter high-scoring grants
        high_scores = df[df['Relevance Score'] >= threshold]

        if high_scores.empty:
            logger.info("No high-scoring grants found. No alert sent.")
            return True

        # Compose email
        msg = EmailMessage()
        msg['Subject'] = f'High-Scoring Grant Opportunities ({len(high_scores)} found)'
        msg['From'] = sender
        msg['To'] = ', '.join(recipients)

        body = "\n\n".join([
            f"{row.get('Title', 'N/A')} (Score: {row['Relevance Score']})\n"
            f"Link: {row.get('Link', 'N/A')}\n"
            f"Deadline: {row.get('Deadline', 'N/A')}"
            for _, row in high_scores.iterrows()
        ])
        msg.set_content(body)

        # Send email with TLS verification
        context = ssl.create_default_context()
        with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as smtp:
            smtp.starttls(context=context)  # Secure TLS with certificate verification
            smtp.login(sender, password)
            smtp.send_message(msg)

        logger.info(f"Email alert sent to {len(recipients)} recipients for {len(high_scores)} high-scoring grants")
        return True

    except FileNotFoundError as e:
        logger.error(f"File error: {e}")
        return False
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP authentication failed: {e}. Check ALERT_SENDER_EMAIL and ALERT_SENDER_PASSWORD")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to send email alert: {e}", exc_info=True)
        return False
