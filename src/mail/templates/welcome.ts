export type WelcomeEmailInput = {
  name?: string | null;
  email: string;
  appUrl: string; // e.g. https://makersflow.in
};

export type RenderedEmail = { subject: string; html: string; text: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderWelcomeEmail({ name, email, appUrl }: WelcomeEmailInput): RenderedEmail {
  const firstName = (name ?? '').trim().split(/\s+/)[0] || 'there';
  const startUrl = `${appUrl.replace(/\/+$/, '')}/explore`;
  const safeName = escapeHtml(firstName);
  const safeEmail = escapeHtml(email);

  const subject = 'Welcome to MakersFlow, your account is ready';

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;font-family:Arial,Helvetica,sans-serif;color:#1b1f24;">
<tr><td style="padding:28px 32px 8px;font-size:22px;font-weight:bold;color:#5b5bd6;">MakersFlow</td></tr>
<tr><td style="padding:8px 32px;font-size:16px;line-height:1.5;">
<p style="margin:0 0 12px;">Hi ${safeName},</p>
<p style="margin:0 0 12px;">Your MakersFlow account has been created successfully with <strong>${safeEmail}</strong>.</p>
<p style="margin:0 0 20px;">You can now explore courses, build projects and order kits.</p>
</td></tr>
<tr><td style="padding:0 32px 24px;">
<a href="${startUrl}" style="display:inline-block;background:#5b5bd6;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 24px;border-radius:8px;">Start learning</a>
</td></tr>
<tr><td style="padding:16px 32px 28px;font-size:12px;line-height:1.5;color:#6b7280;border-top:1px solid #eceef2;">
Didn't create this account? Reply to this email and we'll help.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const text = [
    `Hi ${firstName},`,
    '',
    `Your MakersFlow account has been created successfully with ${email}.`,
    'You can now explore courses, build projects and order kits.',
    '',
    `Start learning: ${startUrl}`,
    '',
    "Didn't create this account? Reply to this email and we'll help.",
  ].join('\n');

  return { subject, html, text };
}
