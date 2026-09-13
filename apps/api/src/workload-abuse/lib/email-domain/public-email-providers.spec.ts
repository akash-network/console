import { describe, expect, it } from "vitest";

import { isPublicEmailProvider } from "./public-email-providers";

describe("isPublicEmailProvider", () => {
  it.each([["gmail.com"], ["outlook.com"], ["proton.me"], ["yandex.ru"], ["cox.net"]])("recognizes %s", domain => {
    expect(isPublicEmailProvider(domain)).toBe(true);
  });

  it.each([["attacker.com"], ["notgmail.com"], ["gmail.com.attacker.net"], ["mail.gmail.com"], ["akash.network"]])("does not recognize %s", domain => {
    expect(isPublicEmailProvider(domain)).toBe(false);
  });
});
