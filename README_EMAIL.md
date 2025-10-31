# Email Setup (Nodemailer with Gmail)

Create a Google App Password for your Gmail account and add to `.env`:

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

Test delivery: start backend and GET `/api/test/email?to=your-email@gmail.com`.

Notes: For institution email, use college SMTP. In production set SPF/DMARC.
