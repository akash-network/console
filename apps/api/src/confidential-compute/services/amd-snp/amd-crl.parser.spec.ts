import { execFileSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AmdCrlParseError, isCertRevoked, isCrlExpired, normalizeSerial, parseAmdCrl, verifyCrlSignature } from "./amd-crl.parser";

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

  // Minimal CA scaffold so `openssl ca -gencrl` can emit a CRL signed by the ARK.
  writeFileSync(
    join(dir, "ca.cnf"),
    [
      "[ca]",
      "default_ca = myca",
      "[myca]",
      "database = index.txt",
      "crlnumber = crlnumber",
      "certificate = ark.pem",
      "private_key = ark.key",
      "default_md = sha384",
      "default_crl_days = 30",
      ""
    ].join("\n")
  );
  // AMD signs CRLs with RSA-PSS; force the same here so the parser is exercised against the real algorithm.
  const gencrl = (out: string) =>
    ossl(["ca", "-config", "ca.cnf", "-gencrl", "-out", out, "-sigopt", "rsa_padding_mode:pss", "-sigopt", "rsa_pss_saltlen:digest"]);
  const toDer = (pem: string, der: string) => {
    ossl(["crl", "-in", pem, "-outform", "DER", "-out", der]);
    return readFileSync(join(dir, der));
  };

  writeFileSync(join(dir, "index.txt"), "");
  writeFileSync(join(dir, "crlnumber"), "1000\n");
  gencrl("crl_clean.pem");
  const cleanCrlDer = toDer("crl_clean.pem", "crl_clean.der");

  // An index entry marks the ASK serial revoked; openssl emits it into the regenerated CRL.
  writeFileSync(join(dir, "index.txt"), `R\t350101000000Z\t240101000000Z\t${askCert.serialNumber}\tunknown\t/CN=SEV-Milan\n`);
  writeFileSync(join(dir, "crlnumber"), "1001\n");
  gencrl("crl_revoked.pem");
  const revokedCrlDer = toDer("crl_revoked.pem", "crl_revoked.der");

  return { dir, arkCert, askCert, cleanCrlDer, revokedCrlDer };
}
