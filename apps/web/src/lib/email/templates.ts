/**
 * Branded HTML email templates. Plain template strings (no render dependency)
 * so they work in any server context. Each returns { subject, html, text }.
 */

const BRAND = {
  name: 'Kabaddiadda',
  primary: '#ff5a1f',
  bg: '#0a0d14',
  card: '#111622',
  text: '#e8eaed',
  muted: '#9aa3b2',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BRAND.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${BRAND.card};border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px;">
                <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:${BRAND.primary};text-transform:uppercase;">${BRAND.name}</div>
                <h1 style="margin:12px 0 0;font-size:22px;font-weight:800;color:${BRAND.text};font-family:Arial,Helvetica,sans-serif;">${heading}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:${BRAND.muted};">
                ${bodyHtml}
              </td>
            </tr>
          </table>
          <div style="max-width:480px;margin-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.muted};text-align:center;">
            © ${BRAND.name}. If you didn't request this email, you can safely ignore it.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;font-family:Arial,Helvetica,sans-serif;">${label}</a>`;
}

export function welcomeEmail({ name, appUrl }: { name?: string; appUrl: string }) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const dashUrl = `${appUrl}/feed`;
  const html = layout('Welcome to Kabaddiadda', `
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 16px;">Your Kabaddiadda account is ready. You're all set to follow leagues, track live scores, and run your tournaments.</p>
    <p style="margin:0 0 28px;">${button(dashUrl, 'Open Kabaddiadda')}</p>
    <p style="margin:0;color:${BRAND.muted};font-size:13px;">Or paste this link into your browser: <br/><span style="color:${BRAND.text};">${dashUrl}</span></p>
  `);
  const text = `${name ? `Hi ${name},` : 'Hi there,'}\n\nYour Kabaddiadda account is ready. Open the app: ${dashUrl}\n\n— Kabaddiadda`;
  return { subject: 'Welcome to Kabaddiadda 🏆', html, text };
}

export function resetPasswordEmail({ resetUrl }: { resetUrl: string }) {
  const html = layout('Reset your password', `
    <p style="margin:0 0 16px;">We received a request to reset the password for your Kabaddiadda account.</p>
    <p style="margin:0 0 16px;">Click the button below to choose a new password. This link expires in 1 hour.</p>
    <p style="margin:0 0 28px;">${button(resetUrl, 'Reset password')}</p>
    <p style="margin:0;color:${BRAND.muted};font-size:13px;">If you didn't request this, ignore this email — your password won't change. <br/>Or paste this link into your browser: <br/><span style="color:${BRAND.text};word-break:break-all;">${resetUrl}</span></p>
  `);
  const text = `Reset your Kabaddiadda password using this link (expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`;
  return { subject: 'Reset your Kabaddiadda password', html, text };
}
