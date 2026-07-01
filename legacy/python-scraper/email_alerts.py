import pandas as pd
import smtplib
from email.message import EmailMessage

def send_high_scoring_grants_alert(file_path, tab_name, threshold, sender, password, recipients):
    df = pd.read_excel(file_path, sheet_name=tab_name)

    if 'Relevance Score' not in df.columns:
        print("⚠️ No 'Relevance Score' column found — add scoring to the sheet "
              "(or a 'Relevance Score' column) before enabling email alerts.")
        return

    high_scores = df[df['Relevance Score'] >= threshold]

    if high_scores.empty:
        print("📭 No high-scoring grants.")
        return

    msg = EmailMessage()
    msg['Subject'] = '🚨 High-Scoring Grant Opportunities'
    msg['From'] = sender
    msg['To'] = ', '.join(recipients)

    def deadline_of(row):
        return row.get('Close Date', row.get('Deadline', 'Unknown'))

    body = "\n\n".join([
        f"{row['Title']} ({row['Relevance Score']})\n{row['Link']}\nDeadline: {deadline_of(row)}\n"
        for _, row in high_scores.iterrows()
    ])
    msg.set_content(body)

    with smtplib.SMTP('smtp.gmail.com', 587) as smtp:
        smtp.starttls()
        smtp.login(sender, password)
        smtp.send_message(msg)

    print(f"📬 Sent alert to {recipients}")
