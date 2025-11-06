import pandas as pd
import smtplib
from email.message import EmailMessage

def send_high_scoring_grants_alert(file_path, tab_name, threshold, sender, password, recipients):
    df = pd.read_excel(file_path, sheet_name=tab_name)
    high_scores = df[df['Relevance Score'] >= threshold]

    if high_scores.empty:
        print("📭 No high-scoring grants.")
        return

    msg = EmailMessage()
    msg['Subject'] = '🚨 High-Scoring Grant Opportunities'
    msg['From'] = sender
    msg['To'] = ', '.join(recipients)

    body = "\n\n".join([
        f"{row['Title']} ({row['Relevance Score']})\n{row['Link']}\nDeadline: {row['Deadline']}\n"
        for _, row in high_scores.iterrows()
    ])
    msg.set_content(body)

    with smtplib.SMTP('smtp.gmail.com', 587) as smtp:
        smtp.starttls()
        smtp.login(sender, password)
        smtp.send_message(msg)

    print(f"📬 Sent alert to {recipients}")
