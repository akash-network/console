import type { LoggerService } from "@akashnetwork/logging";
import { execFileSync } from "node:child_process";
import crypto, { X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { envSchema } from "../../config/env.config";
import { generateCrl } from "./amd-crl.test-fixtures";
import type { AmdKdsClient } from "./amd-kds.client";
import { AmdSnpService } from "./amd-snp.service";
import { SNP_REPORT_MIN_LENGTH } from "./snp-report.parser";

// A real ARK→ASK→VCEK chain generated once via openssl (RSA ARK/ASK as AMD issues them, P-384 VCEK that
// signs the report), plus the VCEK private key used to sign reports. Generating it at test time keeps the
// suite hermetic (no committed keys, no network). `chain` stands in for the AMD-issued chain (the mocked KDS
// vouches for it); `forgedChain` is an attacker-controlled self-signed chain.
let chain: ReturnType<typeof generateChain>;
let forgedChain: ReturnType<typeof generateChain>;
// CRLs signed by the chain's ARK: one clean, one revoking the ASK. Drive the revocation-check paths.
let cleanCrlDer: Buffer;
let revokedCrlDer: Buffer;

beforeAll(() => {
  chain = generateChain();
  forgedChain = generateChain();
  const askSerial = new X509Certificate(chain.askPem).serialNumber;
  cleanCrlDer = generateCrl(chain.dir, []);
  revokedCrlDer = generateCrl(chain.dir, [askSerial]);
});

afterAll(() => {
  if (chain) rmSync(chain.dir, { recursive: true, force: true });
  if (forgedChain) rmSync(forgedChain.dir, { recursive: true, force: true });
});

describe(AmdSnpService.name, () => {
  it("returns valid for a genuine chain with a matching nonce", async () => {
    const nonce = crypto.randomBytes(64);
    const report = buildSignedReport(nonce);
    const { service } = setup({ withKds: true });

    const verdict = await service.verify({ report: report.toString("base64"), certChain: "", nonce: nonce.toString("base64") });

    expect(verdict).toMatchObject({ kind: "cpu", vendor: "amd-sev-snp", status: "valid" });
    expect(verdict.checks).toEqual({ certChainValid: true, signatureValid: true, nonceMatch: true, notRevoked: true });
    expect(verdict.detail).not.toMatch(/revocation not checked/i);
  });

  it("returns invalid when the report signature does not verify", async () => {
    const nonce = crypto.randomBytes(64);
    const report = buildSignedReport(nonce);
    report[0x10] ^= 0xff; // flip a byte inside the signed region, after signing
    const { service } = setup({ withKds: true });

    const verdict = await service.verify({ report: report.toString("base64"), certChain: "", nonce: nonce.toString("base64") });

    expect(verdict.status).toBe("invalid");
    expect(verdict.checks?.signatureValid).toBe(false);
  });

  it("returns invalid when the report is not bound to the request nonce", async () => {
    const report = buildSignedReport(crypto.randomBytes(64));
    const { service } = setup({ withKds: true });

    const verdict = await service.verify({ report: report.toString("base64"), certChain: "", nonce: crypto.randomBytes(64).toString("base64") });

    expect(verdict.status).toBe("invalid");
    expect(verdict.checks?.nonceMatch).toBe(false);
  });

  it("returns unverifiable when no candidate product resolves against AMD KDS", async () => {
    const nonce = crypto.randomBytes(64);
    const report = buildSignedReport(nonce);
    const { service, kdsClient } = setup({ withKds: false });

    const verdict = await service.verify({ report: report.toString("base64"), certChain: "", nonce: nonce.toString("base64") });

    expect(verdict.status).toBe("unverifiable");
    expect(kdsClient.getCaChain).toHaveBeenCalled();
  });

  it("probes candidate products in order and stops at the first that resolves", async () => {
    const nonce = crypto.randomBytes(64);
    const report = buildSignedReport(nonce);
    const { service, kdsClient } = setup({ withKds: true, products: ["Milan", "Genoa", "Turin"], resolvingProduct: "Genoa" });

    await service.verify({ report: report.toString("base64"), certChain: "", nonce: nonce.toString("base64") });

    expect(kdsClient.getCaChain).toHaveBeenCalledWith("Milan");
    expect(kdsClient.getCaChain).toHaveBeenCalledWith("Genoa");
    expect(kdsClient.getCaChain).not.toHaveBeenCalledWith("Turin");
  });

  it("returns invalid for a malformed report", async () => {
    const { service } = setup({ withKds: true });

    const verdict = await service.verify({ report: Buffer.alloc(10).toString("base64"), certChain: "", nonce: crypto.randomBytes(64).toString("base64") });

    expect(verdict.status).toBe("invalid");
    expect(verdict.detail).toMatch(/too short/i);
  });

  it("anchors an embedded VCEK to AMD KDS and skips the per-chip VCEK fetch", async () => {
    const nonce = crypto.randomBytes(64);
    const report = buildSignedReport(nonce);
    const embedded = Buffer.from([chain.vcekPem, chain.askPem, chain.arkPem].join("\n")).toString("base64");
    const { service, kdsClient } = setup({ withKds: true });

    const verdict = await service.verify({ report: report.toString("base64"), certChain: embedded, nonce: nonce.toString("base64") });

    expect(verdict.status).toBe("valid");
    // The trust anchor (ARK/ASK) still comes from AMD KDS; only the per-chip VCEK fetch is skipped.
    expect(kdsClient.getCaChain).toHaveBeenCalled();
    expect(kdsClient.getVcek).not.toHaveBeenCalled();
  });

  it("returns unverifiable for a self-consistent forged chain that does not anchor to the AMD KDS root", async () => {
    const nonce = crypto.randomBytes(64);
    // Report signed by the attacker's own VCEK, presented with the attacker's full self-signed ARK→ASK→VCEK chain.
    const report = buildSignedReport(nonce, forgedChain);
    const embedded = Buffer.from([forgedChain.vcekPem, forgedChain.askPem, forgedChain.arkPem].join("\n")).toString("base64");
    // KDS vouches only for the genuine `chain`; the forged chip is not AMD-issued, so KDS has no VCEK for it either.
    const { service } = setup({ withKds: true, vcekInKds: false });

    const verdict = await service.verify({ report: report.toString("base64"), certChain: embedded, nonce: nonce.toString("base64") });

    expect(verdict.status).toBe("unverifiable");
    expect(verdict.detail).toMatch(/anchor/i);
  });

  it("returns invalid when AMD has revoked the signing key in the chain", async () => {
    const nonce = crypto.randomBytes(64);
    const report = buildSignedReport(nonce);
    const { service } = setup({ withKds: true, crl: "revoked" });

    const verdict = await service.verify({ report: report.toString("base64"), certChain: "", nonce: nonce.toString("base64") });

    expect(verdict.status).toBe("invalid");
    expect(verdict.checks?.notRevoked).toBe(false);
  });

  it("returns unverifiable when the AMD CRL cannot be retrieved", async () => {
    const nonce = crypto.randomBytes(64);
    const report = buildSignedReport(nonce);
    const { service } = setup({ withKds: true, crl: "missing" });

    const verdict = await service.verify({ report: report.toString("base64"), certChain: "", nonce: nonce.toString("base64") });

    expect(verdict.status).toBe("unverifiable");
    expect(verdict.checks?.notRevoked).toBeUndefined();
  });

  it("returns unverifiable when fetching the AMD CRL throws", async () => {
    const nonce = crypto.randomBytes(64);
    const report = buildSignedReport(nonce);
    const { service } = setup({ withKds: true, crl: "error" });

    const verdict = await service.verify({ report: report.toString("base64"), certChain: "", nonce: nonce.toString("base64") });

    expect(verdict.status).toBe("unverifiable");
  });

  function setup(input: {
    withKds: boolean;
    products?: string[];
    resolvingProduct?: string;
    vcekInKds?: boolean;
    crl?: "clean" | "revoked" | "missing" | "error";
  }) {
    const kdsClient = mock<AmdKdsClient>();
    const resolving = input.resolvingProduct ?? "Genoa";
    const vcekInKds = input.vcekInKds ?? true;
    kdsClient.getCaChain.mockImplementation(async product => (input.withKds && product === resolving ? { ask: chain.askPem, ark: chain.arkPem } : null));
    kdsClient.getVcek.mockImplementation(async product => (input.withKds && vcekInKds && product === resolving ? chain.vcekDer : null));
    kdsClient.getCrl.mockImplementation(async () => {
      if (input.crl === "missing") return null;
      if (input.crl === "error") throw new Error("AMD KDS unavailable");
      return input.crl === "revoked" ? revokedCrlDer : cleanCrlDer;
    });

    const config = { ...envSchema.parse({}), AMD_SNP_PRODUCTS: input.products ?? [resolving] };
    const service = new AmdSnpService(kdsClient, config, mock<LoggerService>());
    return { service, kdsClient };
  }
});

/** Builds a 1184-byte SNP report whose report_data is `nonce`, signed over its signed region by the VCEK key. */
function buildSignedReport(nonce: Buffer, signingChain = chain): Buffer {
  const report = Buffer.alloc(SNP_REPORT_MIN_LENGTH);
  report.writeUInt32LE(2, 0x00); // version
  report.writeUInt32LE(1, 0x34); // signature_algo = ECDSA P-384/SHA-384
  nonce.copy(report, 0x50); // report_data
  Buffer.from("0123456789abcdef".repeat(4), "hex").copy(report, 0x1a0); // chip_id (arbitrary)

  const signedData = report.subarray(0, 0x2a0);
  const sig = crypto.sign("sha384", signedData, { key: signingChain.vcekKeyPem, dsaEncoding: "ieee-p1363" }); // 96 bytes BE (r||s)
  Buffer.from(sig.subarray(0, 48)).reverse().copy(report, 0x2a0); // r, little-endian
  Buffer.from(sig.subarray(48, 96))
    .reverse()
    .copy(report, 0x2a0 + 72); // s, little-endian
  return report;
}

function generateChain() {
  const dir = mkdtempSync(join(tmpdir(), "snp-chain-"));
  const ossl = (args: string[]) => execFileSync("openssl", args, { cwd: dir });
  const genRsaKey = (name: string) => ossl(["genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048", "-out", `${name}.key`]);
  const genEcKey = (name: string) => ossl(["ecparam", "-name", "secp384r1", "-genkey", "-noout", "-out", `${name}.key`]);
  const selfSign = (name: string, cn: string) =>
    ossl(["req", "-new", "-x509", "-key", `${name}.key`, "-out", `${name}.pem`, "-days", "2", "-subj", `/CN=${cn}`, "-sha384"]);
  const caSign = (name: string, cn: string, ca: string) => {
    ossl(["req", "-new", "-key", `${name}.key`, "-out", `${name}.csr`, "-subj", `/CN=${cn}`, "-sha384"]);
    ossl(["x509", "-req", "-in", `${name}.csr`, "-CA", `${ca}.pem`, "-CAkey", `${ca}.key`, "-CAcreateserial", "-out", `${name}.pem`, "-days", "2", "-sha384"]);
  };
  const read = (name: string) => readFileSync(join(dir, name), "utf-8");

  // ARK/ASK are RSA (as AMD issues them) so the ARK can sign an RSA-PSS CRL; the VCEK is P-384 because it signs the report.
  genRsaKey("ark");
  selfSign("ark", "ARK");
  genRsaKey("ask");
  caSign("ask", "ASK", "ark");
  genEcKey("vcek");
  caSign("vcek", "VCEK", "ask");

  return {
    dir,
    arkPem: read("ark.pem"),
    askPem: read("ask.pem"),
    vcekPem: read("vcek.pem"),
    vcekKeyPem: read("vcek.key"),
    vcekDer: Buffer.from(new X509Certificate(read("vcek.pem")).raw)
  };
}
