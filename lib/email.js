'use strict';

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM    = process.env.EMAIL_FROM || 'access@winonany.com';
const APP_URL = process.env.APP_URL    || 'https://winonany.com';

/**
 * Send the download link email immediately after purchase.
 */
async function sendDownloadEmail(toEmail, tier, downloadToken, successUrl) {
  const tierLabels = {
    access:  'Starter',
    system:  'The Vault',
    control: 'Full Access',
  };

  const label      = tierLabels[tier] || tier;
  const link       = successUrl || `${APP_URL}/success?token=${downloadToken}`;
  const expiryHrs  = process.env.DOWNLOAD_EXPIRY_HOURS || '48';

  await resend.emails.send({
    from:    FROM,
    to:      toEmail,
    subject: `Your WinOnAny access — ${label}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050507;font-family:'Helvetica Neue',Arial,sans-serif;color:#F2F2F4">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050507;padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0B0B0F;border:1px solid rgba(255,255,255,.08);max-width:520px;width:100%">
        <tr><td style="height:3px;background:linear-gradient(90deg,#6E56F8,#9A4AC8)"></td></tr>
        <tr><td style="padding:40px 36px 32px">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#5C5C66">WinOnAny</p>
          <h1 style="margin:0 0 24px;font-size:28px;font-weight:800;letter-spacing:-.04em;line-height:1.05">Access granted.</h1>
          <p style="margin:0 0 8px;color:#85858F;font-size:15px;line-height:1.6">Your <strong style="color:#F2F2F4">${label}</strong> is ready. Your download link is below.</p>
          <p style="margin:0 0 32px;color:#5C5C66;font-size:13px">Link expires in ${expiryHrs} hours. Create an account on the download page to keep access permanently.</p>
          <a href="${link}" style="display:inline-block;background:#6E56F8;color:#fff;font-size:15px;font-weight:600;letter-spacing:.01em;padding:16px 32px;text-decoration:none">Download now →</a>
          <p style="margin:32px 0 0;color:#5C5C66;font-size:12px;line-height:1.7">
            If the button doesn't work, copy this link:<br>
            <a href="${link}" style="color:#8B78FF;word-break:break-all">${link}</a>
          </p>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,.07)">
          <p style="margin:0;color:#5C5C66;font-size:11px;letter-spacing:.04em">WinOnAny · winonany.com · Questions? Reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim(),
  });
}

/**
 * Send welcome email after account creation.
 */
async function sendWelcomeEmail(toEmail, tier) {
  const tierLabels = { access: 'Starter', system: 'The Vault', control: 'Full Access' };
  const label = tierLabels[tier] || tier;

  await resend.emails.send({
    from:    FROM,
    to:      toEmail,
    subject: 'Your WinOnAny account is active',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050507;font-family:'Helvetica Neue',Arial,sans-serif;color:#F2F2F4">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050507;padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0B0B0F;border:1px solid rgba(255,255,255,.08);max-width:520px;width:100%">
        <tr><td style="height:3px;background:linear-gradient(90deg,#6E56F8,#9A4AC8)"></td></tr>
        <tr><td style="padding:40px 36px 32px">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#5C5C66">WinOnAny</p>
          <h1 style="margin:0 0 24px;font-size:28px;font-weight:800;letter-spacing:-.04em">Account active.</h1>
          <p style="margin:0 0 32px;color:#85858F;font-size:15px;line-height:1.6">You now have permanent access to your <strong style="color:#F2F2F4">${label}</strong>. Log in any time at the link below.</p>
          <a href="${APP_URL}/login" style="display:inline-block;background:#6E56F8;color:#fff;font-size:15px;font-weight:600;letter-spacing:.01em;padding:16px 32px;text-decoration:none">Go to my account →</a>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,.07)">
          <p style="margin:0;color:#5C5C66;font-size:11px;letter-spacing:.04em">WinOnAny · winonany.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim(),
  });
}

module.exports = { sendDownloadEmail, sendWelcomeEmail };
