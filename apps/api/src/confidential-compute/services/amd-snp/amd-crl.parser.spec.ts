import { execFileSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AmdCrlParseError, isCertRevoked, isCrlExpired, normalizeSerial, parseAmdCrl, verifyCrlSignature } from "./amd-crl.parser";
import { generateCrl } from "./amd-crl.test-fixtures";

// A real RSA ARK→ASK chain plus RSA-PSS CRLs (clean and one revoking the ASK), generated once via
// openssl to mirror AMD KDS — which issues RSA-4096 ARKs and signs its CRLs with RSA-PSS/SHA-384.
// Hermetic: no committed keys, no network.
let fixtures: ReturnType<typeof generateCrlFixtures>;

beforeAll(() => {
  fixtures = generateCrlFixtures();
});

afterAll(() => {
  if (fixtures) rmSync(fixtures.dir, { recursive: true, force: true });
});

describe(parseAmdCrl.name, () => {
  it("parses nextUpdate and an empty revoked list from a clean CRL", () => {
    const crl = parseAmdCrl(fixtures.cleanCrlDer);

    expect(crl.revokedSerials.size).toBe(0);
    expect(crl.nextUpdate).toBeInstanceOf(Date);
    expect((crl.nextUpdate as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it("extracts the revoked serial number from a CRL with revocations", () => {
    const crl = parseAmdCrl(fixtures.revokedCrlDer);

    expect(crl.revokedSerials.has(normalizeSerial(fixtures.askCert.serialNumber))).toBe(true);
  });

  it("throws AmdCrlParseError for bytes that are not a CRL", () => {
    expect(() => parseAmdCrl(Buffer.from("clearly not a DER-encoded CRL"))).toThrow(AmdCrlParseError);
  });

  it("rejects an out-of-range time component instead of silently normalizing it", () => {
    // Set nextUpdate's month to "13"; Date.UTC would roll it to next January without the round-trip guard.
    const corrupted = withNextUpdateMonth(fixtures.cleanCrlDer, "13");

    expect(() => parseAmdCrl(corrupted)).toThrow(AmdCrlParseError);
  });
});

describe(verifyCrlSignature.name, () => {
  it("verifies an RSA-PSS CRL signed by the issuing ARK", () => {
    const crl = parseAmdCrl(fixtures.cleanCrlDer);

    expect(verifyCrlSignature(crl, fixtures.arkCert)).toBe(true);
  });

  it("rejects a CRL when verified against a certificate that did not sign it", () => {
    const crl = parseAmdCrl(fixtures.cleanCrlDer);

    expect(verifyCrlSignature(crl, fixtures.askCert)).toBe(false);
  });

  it("rejects a CRL whose signed content was tampered with", () => {
    const crl = parseAmdCrl(fixtures.cleanCrlDer);
    const tampered = { ...crl, tbsDer: Buffer.from(crl.tbsDer) };
    tampered.tbsDer[20] ^= 0xff;

    expect(verifyCrlSignature(tampered, fixtures.arkCert)).toBe(false);
  });
});

describe(isCertRevoked.name, () => {
  it("returns true when the certificate serial is listed as revoked", () => {
    const crl = parseAmdCrl(fixtures.revokedCrlDer);

    expect(isCertRevoked(crl, fixtures.askCert)).toBe(true);
  });

  it("returns false when the certificate serial is not listed", () => {
    const crl = parseAmdCrl(fixtures.cleanCrlDer);

    expect(isCertRevoked(crl, fixtures.askCert)).toBe(false);
  });
});

describe(normalizeSerial.name, () => {
  it("strips a leading sign byte and uppercases", () => {
    expect(normalizeSerial("00a1b2")).toBe("A1B2");
  });

  it("treats serials that differ only by leading zeros as equal", () => {
    expect(normalizeSerial("0010001")).toBe(normalizeSerial("10001"));
  });

  it("preserves an all-zero serial", () => {
    expect(normalizeSerial("00")).toBe("0");
  });
});

describe(isCrlExpired.name, () => {
  it("returns true once now is at or past nextUpdate", () => {
    const crl = parseAmdCrl(fixtures.cleanCrlDer);

    expect(isCrlExpired(crl, new Date((crl.nextUpdate as Date).getTime() + 1000))).toBe(true);
  });

  it("returns false while the CRL is still current", () => {
    const crl = parseAmdCrl(fixtures.cleanCrlDer);

    expect(isCrlExpired(crl, new Date((crl.nextUpdate as Date).getTime() - 1000))).toBe(false);
  });

  it("treats a CRL with no freshness bound as expired (fails closed)", () => {
    const crl = parseAmdCrl(fixtures.cleanCrlDer);

    expect(isCrlExpired({ ...crl, nextUpdate: null }, new Date())).toBe(true);
  });
});

function generateCrlFixtures() {
  const dir = mkdtempSync(join(tmpdir(), "amd-crl-"));
  const ossl = (args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: ["ignore", "ignore", "pipe"] });
  const rsaKey = (name: string) => ossl(["genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048", "-out", name]);

  rsaKey("ark.key");
  ossl(["req", "-new", "-x509", "-key", "ark.key", "-out", "ark.pem", "-days", "2", "-subj", "/CN=ARK-Milan", "-sha384"]);
  rsaKey("ask.key");
  ossl(["req", "-new", "-key", "ask.key", "-out", "ask.csr", "-subj", "/CN=SEV-Milan", "-sha384"]);
  ossl(["x509", "-req", "-in", "ask.csr", "-CA", "ark.pem", "-CAkey", "ark.key", "-CAcreateserial", "-out", "ask.pem", "-days", "2", "-sha384"]);

  const arkCert = new X509Certificate(readFileSync(join(dir, "ark.pem")));
  const askCert = new X509Certificate(readFileSync(join(dir, "ask.pem")));

  const cleanCrlDer = generateCrl(dir, []);
  const revokedCrlDer = generateCrl(dir, [askCert.serialNumber]);

  return { dir, arkCert, askCert, cleanCrlDer, revokedCrlDer };
}

/** Returns a copy of the CRL DER with nextUpdate's 2-digit month overwritten, to forge an invalid time. */
function withNextUpdateMonth(der: Buffer, month: string): Buffer {
  const copy = Buffer.from(der);
  let seen = 0;
  for (let i = 0; i + 15 <= copy.length; i++) {
    // UTCTime = tag 0x17, length 0x0d, then 13 ASCII bytes ending in 'Z' (0x5a): YYMMDDHHMMSSZ.
    if (copy[i] === 0x17 && copy[i + 1] === 0x0d && copy[i + 14] === 0x5a) {
      seen += 1;
      // The first UTCTime is thisUpdate (skipped by the parser); the second is nextUpdate.
      if (seen === 2) {
        copy.write(month, i + 4, "latin1"); // month occupies the 3rd–4th content bytes
        return copy;
      }
    }
  }
  throw new Error("nextUpdate UTCTime not found in fixture");
}
