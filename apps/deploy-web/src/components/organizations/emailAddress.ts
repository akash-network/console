export const INVALID_EMAIL_MESSAGE = "Not a valid email address";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailAddress(text: string) {
  return EMAIL_PATTERN.test(text);
}
