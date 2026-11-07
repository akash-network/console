import escapeHtml from "lodash/escape";

export const SUPPORT_EMAIL = "support@akash.network";

export const SUPPORT_CONTACT_PARAGRAPH = `<p>If you have questions, email us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`;

export function userReasonParagraph(userReason: string | null): string {
  return userReason ? `<p><strong>Reason:</strong> ${escapeHtml(userReason)}</p>` : "";
}
