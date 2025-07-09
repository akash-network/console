import { faker } from "@faker-js/faker";

import { parseSetCookies } from "./cookies";

export async function loginViaOauth(appUrl: string): Promise<Record<string, string>> {
  const response = await fetch(`${appUrl}/api/auth/login`, {
    redirect: "manual"
  });

  const redirectUrl = response.headers.get("location");
  if (!redirectUrl) {
    throw new Error(`/api/auth/login did not redirect to oauth provider on login attempt: ${response.status}`);
  }

  const appCookies = response.headers.get("set-cookie");
  if (!appCookies) {
    throw new Error(`/api/auth/login did not set app oauth specific cookies on login attempt: ${response.status}`);
  }

  const oauthResponse = await fetch(redirectUrl, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      username: faker.person.fullName(),
      claims: JSON.stringify({
        sub: faker.string.uuid(),
        email: faker.internet.email(),
        email_verified: true,
        name: faker.person.fullName(),
        nickname: faker.person.firstName(),
        picture: faker.image.url(),
        updated_at: faker.date.recent().toISOString()
      })
    })
  });

  const appCallbackUrl = oauthResponse.headers.get("location");
  if (!appCallbackUrl) {
    throw new Error(`oauth provider did not redirect to app callback: ${oauthResponse.status}`);
  }

  const finalResponse = await fetch(appCallbackUrl, {
    method: "GET",
    redirect: "manual",
    headers: {
      Cookie: appCookies
    }
  });

  const session = finalResponse.headers.get("set-cookie");
  if (!session) {
    throw new Error(`app callback did not set session cookie: ${finalResponse.status}`);
  }

  return parseSetCookies(session);
}
