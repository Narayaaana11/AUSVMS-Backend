const nodemailer = require('nodemailer');
const axios = require('axios');

async function sendEmail({ to, subject, html }) {
  try {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const useEthereal = String(process.env.USE_ETHEREAL || '').toLowerCase() === 'true';

    let transporter;
    let fromAddress = user;

    if (!user || !pass) {
      if (!useEthereal) {
        console.warn('[email] missing EMAIL_USER/EMAIL_PASS and USE_ETHEREAL not enabled');
        return false;
      }
    }

    if (user && pass) {
      const host = process.env.SMTP_HOST || 'smtp.gmail.com';
      const port = Number(process.env.SMTP_PORT || 465);
      const secure = String(process.env.SMTP_SECURE || 'true') === 'true';

      const buildTransport = (h, p, s) => nodemailer.createTransport({ host: h, port: p, secure: s, auth: { user, pass }, tls: { rejectUnauthorized: false } });
      transporter = buildTransport(host, port, secure);
      try { await transporter.verify(); } catch (e) { console.warn('[email] verify failed:', e?.code || '', e?.message); }
      try {
        const info = await transporter.sendMail({ from: fromAddress, to, subject, html });
        console.log('[email] sent via SMTP:', info?.messageId);
        return true;
      } catch (err1) {
        console.warn('[email] send attempt 1 failed:', err1?.code || '', err1?.response || err1?.message);
        try {
          transporter = buildTransport(process.env.SMTP_HOST || 'smtp.gmail.com', 587, false);
          await transporter.verify().catch((e) => console.warn('[email] verify (587) failed:', e?.code || '', e?.message));
          const info = await transporter.sendMail({ from: fromAddress, to, subject, html });
          console.log('[email] sent via SMTP:587:', info?.messageId);
          return true;
        } catch (err2) {
          console.error('[email] send attempt 2 failed:', err2?.code || '', err2?.response || err2?.message);
          if (!useEthereal) return false;
        }
      }
    }

    // Ethereal fallback (dev preview)
    if (useEthereal) {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      const info = await transporter.sendMail({ from: 'Aditya University <no-reply@aditya.edu>', to, subject, html });
      console.log('[email] ethereal preview URL:', nodemailer.getTestMessageUrl(info));
      return true;
    }

    return false;
  } catch (err) {
    console.error('[email] unexpected error:', err?.code || '', err?.message);
    return false;
  }
}

async function sendSMS({ to, message }) {
  // Placeholder for Twilio or other provider
  return { to, message, sent: false };
}

async function sendWhatsApp({ to, message }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneNumberId) return false;
  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return true;
  } catch {
    return false;
  }
}

module.exports = { sendEmail, sendSMS, sendWhatsApp };


