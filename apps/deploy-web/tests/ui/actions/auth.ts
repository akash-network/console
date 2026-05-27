import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";
import { AuthPage } from "../pages/AuthPage";
import { AuthPagePasswordless } from "../pages/AuthPagePasswordless";
import type { Auth0ManagementService } from "../services/auth0-management.service";
import type { EmailVerificationStrategy } from "../services/email-verification";
import { MailsacCodeVerificationStrategy } from "../services/email-verification/mailsac-code.strategy";

/** Which credential mechanism a flow authenticates with. */
export type AuthType = "passwordless" | "email-password";

export function generateTestPassword(): string {
  return `E2e!${crypto.randomUUID()}`;
}

/**
 * Logs in the preconfigured TEST_USER via the given auth type, leaving the page authenticated.
 */
export async function loginExistingUser(page: Page, authType: AuthType): Promise<void> {
  if (!testEnvConfig.TEST_USER_EMAIL || !testEnvConfig.TEST_USER_PASSWORD) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD env vars are required for userType: "existing" tests');
  }

  if (authType === "passwordless") {
    await signInPasswordless(page, testEnvConfig.TEST_USER_EMAIL);
  } else {
    await signInWithPassword(page, { email: testEnvConfig.TEST_USER_EMAIL, password: testEnvConfig.TEST_USER_PASSWORD });
  }

  await page.waitForURL(url => !url.pathname.includes("/login"), { timeout: 15_000 });
  await page.getByLabel("Connected wallet name and balance").waitFor({ timeout: 30_000 });
}

/**
 * Registers a brand-new user via the given auth type, leaving the page on an authenticated
 * session. Returns the created identity so callers can clean it up.
 */
export async function registerNewUser(
  page: Page,
  deps: { auth0: Auth0ManagementService; emailVerification: EmailVerificationStrategy; authType: AuthType }
): Promise<{ email: string; userId: string }> {
  const email = deps.authType === "passwordless" ? await registerPasswordless(page) : await registerWithEmailPassword(page, deps);

  const auth0User = await deps.auth0.getUserByEmail(email);
  if (!auth0User) throw new Error(`Auth0 user was not created for ${email}`);

  return { email, userId: auth0User.user_id };
}

async function registerPasswordless(page: Page): Promise<string> {
  const otp = new MailsacCodeVerificationStrategy(testEnvConfig.MAILSAC_API_KEY);
  const email = otp.generateEmail();
  await signInPasswordless(page, email);
  return email;
}

async function registerWithEmailPassword(page: Page, deps: { auth0: Auth0ManagementService; emailVerification: EmailVerificationStrategy }): Promise<string> {
  const email = deps.emailVerification.generateEmail();
  const auth = new AuthPage(page);

  await page.goto(`${testEnvConfig.BASE_URL}/login?tab=signup`);
  await auth.signUp({ email, password: generateTestPassword() });

  const created = await deps.auth0.getUserByEmail(email);
  if (!created) throw new Error(`Auth0 user was not created for ${email}`);

  await deps.emailVerification.verify({ context: page.context(), email, userId: created.user_id });
  await page.waitForURL(url => !url.pathname.includes("/login"), { timeout: 30_000 });

  return email;
}

/** Drives the email + password login form for the given credentials. */
async function signInWithPassword(page: Page, credentials: { email: string; password: string }): Promise<void> {
  const auth = new AuthPage(page);
  await auth.goto();
  await auth.signIn(credentials);
}

/** Drives the passwordless (email OTP via Mailsac) flow for the given email. */
async function signInPasswordless(page: Page, email: string): Promise<void> {
  const otp = new MailsacCodeVerificationStrategy(testEnvConfig.MAILSAC_API_KEY);
  const auth = new AuthPagePasswordless(page);

  await auth.goto();
  await auth.startWithEmail(email);
  await auth.waitForVerifyScreen();
  await otp.verify({ context: page.context(), email, userId: "" });
  await auth.waitForRedirectAwayFromLogin();
}
