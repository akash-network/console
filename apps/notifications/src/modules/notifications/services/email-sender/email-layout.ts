import escape from "lodash/escape";

const LOGO_LIGHT_URL = "https://console-cdn.akash.network/akashconsole-logo.png";
const LOGO_DARK_URL = "https://console-cdn.akash.network/akashconsole-logo-dark.png";

export interface EmailAction {
  label: string;
  url: string;
}

function isHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function renderAction({ label, url }: EmailAction, isPrimary: boolean, isLast: boolean): string {
  const buttonClass = isPrimary ? "btn-primary" : "btn-secondary";
  const fill = isPrimary ? "background-color:#171717;" : "background-color:#ffffff;border:1px solid #171717;";
  const textColor = isPrimary ? "#ffffff" : "#171717";
  const gutter = isLast ? "" : "padding-right:12px;";

  return `<td class="btn-cell" style="${gutter}">
                <table role="presentation" cellpadding="0" cellspacing="0" class="btn-wrap">
                  <tr><td class="${buttonClass}" style="${fill}border-radius:8px;">
                    <a href="${escape(url)}" class="btn-link ${buttonClass}-text" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:500;line-height:1.2;color:${textColor};text-decoration:none;">${escape(label)}</a>
                  </td></tr>
                </table>
              </td>`;
}

function renderActions(actions: EmailAction[] = []): string {
  const renderable = actions.filter(action => isHttpUrl(action.url));

  if (!renderable.length) {
    return "";
  }

  const cells = renderable.map((action, index) => renderAction(action, index === 0, index === renderable.length - 1)).join("\n              ");

  return `<div style="padding-top:28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" class="btn-row"><tr>
              ${cells}
            </tr></table>
          </div>`;
}

/** Kept as one unbroken token with no letter-spacing so a double-click selects the whole code and autofill can read it. */
function renderCode(code?: string): string {
  if (!code) {
    return "";
  }

  return `<div style="padding-top:28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
              <td class="code-box" align="center" style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:20px 24px;">
                <span class="code-text" style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:32px;font-weight:700;line-height:1.2;color:#18181b;">${escape(code)}</span>
              </td>
            </tr></table>
          </div>`;
}

/** The subject is user-controlled for alert emails, so it is escaped; content must already be sanitized by the caller. */
export function renderEmailLayout({ subject, content, actions, code }: { subject: string; content: string; actions?: EmailAction[]; code?: string }): string {
  const escapedSubject = escape(subject);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapedSubject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f0f0f1; }
    a { color: #52525b; }
    .logo-dark { display: none; }
    @media (max-width: 480px) {
      .btn-row { width: 100% !important; }
      .btn-cell { display: block !important; width: 100% !important; padding: 0 0 12px 0 !important; }
      .btn-wrap { width: 100% !important; }
      .btn-link { display: block !important; text-align: center !important; }
    }
    @media (prefers-color-scheme: dark) {
      body, .outer { background-color: #0a0a0a !important; }
      .card { background-color: #141414 !important; border-color: #27272a !important; }
      .card-footer { background-color: #101010 !important; border-color: #27272a !important; }
      .header-border { border-color: #27272a !important; }
      .heading { color: #fafafa !important; }
      .body-text { color: #d4d4d8 !important; }
      .body-text strong { color: #fafafa !important; }
      .muted, .footer-text { color: #a1a1aa !important; }
      .logo-light { display: none !important; }
      .logo-dark { display: inline-block !important; }
      .btn-primary { background-color: #e5e5e5 !important; }
      .btn-primary-text { color: #171717 !important; }
      .btn-secondary { background-color: transparent !important; border-color: #e5e5e5 !important; }
      .btn-secondary-text { color: #e5e5e5 !important; }
      .code-box { background-color: #101010 !important; border-color: #27272a !important; }
      .code-text { color: #fafafa !important; }
    }
  </style>
</head>
<body class="outer" style="margin:0;padding:0;background-color:#f0f0f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer" style="background-color:#f0f0f1;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="card" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
        <tr><td class="header-border" style="padding:24px 40px;border-bottom:1px solid #f0f0f1;">
          <img src="${LOGO_LIGHT_URL}" alt="Akash Console" width="173" height="19" class="logo-light" style="display:inline-block;border:0;" />
          <img src="${LOGO_DARK_URL}" alt="Akash Console" width="173" height="19" class="logo-dark" style="display:none;border:0;" />
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h1 class="heading" style="margin:0 0 24px 0;font-size:24px;line-height:1.3;font-weight:700;color:#18181b;">${escapedSubject}</h1>
          <div class="body-text" style="font-size:16px;line-height:1.65;color:#3f3f46;">${content}</div>
          ${renderCode(code)}
          ${renderActions(actions)}
        </td></tr>
        <tr><td class="card-footer" style="padding:24px 40px;background-color:#fafafa;border-top:1px solid #f0f0f1;">
          <p class="muted" style="margin:0 0 12px 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a1a1aa;font-family:'SF Mono',Menlo,Consolas,monospace;">Akash &middot; The Open Compute Marketplace</p>
          <p class="footer-text" style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Sent by Akash Console. You're receiving this because you have an Akash Console account.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
