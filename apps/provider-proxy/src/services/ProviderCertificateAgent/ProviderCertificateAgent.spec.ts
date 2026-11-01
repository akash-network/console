import type { X509Certificate } from "node:crypto";
import https from "node:https";
import type { AddressInfo } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import type { TLSSocket } from "node:tls";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { createX509CertPair } from "../../../test/seeders/createX509CertPair";
import type { CertificateValidator, CertValidationResult } from "../CertificateValidator/CertificateValidator";
import { ProviderCertificateAgent, ProviderCertificateRejectedError, verifyProviderCertificate } from "./ProviderCertificateAgent";

describe(ProviderCertificateAgent.name, () => {
  it("sends the request once the provider's certificate passes", async () => {
    const { send, received, certificateValidator } = await setup();
    certificateValidator.validate.mockResolvedValue({ ok: true });

    const result = await send();

    expect(result).toEqual({ status: 200 });
    expect(received).toEqual([{ authorization: "Bearer token", body: "manifest" }]);
    expect(certificateValidator.validate).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("akash1provider") }),
      "akash1provider"
    );
  });

  it("sends nothing to a peer whose certificate is rejected", async () => {
    const { send, received, certificateValidator } = await setup();
    certificateValidator.validate.mockResolvedValue({ ok: false, code: "fingerprintMismatch" });

    const result = await send();

    expect(result.error).toBeInstanceOf(ProviderCertificateRejectedError);
    expect(result.error).toMatchObject({
      name: "ProviderCertificateRejectedError",
      message: "Provider certificate rejected: fingerprintMismatch",
      code: "fingerprintMismatch"
    });
    expect(received).toEqual([]);
  });

  it("holds back the request until the certificate check finishes", async () => {
    const { send, received, certificateValidator } = await setup();
    const check = Promise.withResolvers<CertValidationResult>();
    certificateValidator.validate.mockReturnValue(check.promise);

    const pending = send();
    await vi.waitFor(() => expect(certificateValidator.validate).toHaveBeenCalled());
    await delay(50);

    expect(received).toEqual([]);
    check.resolve({ ok: true });
    await expect(pending).resolves.toEqual({ status: 200 });
    expect(received).toHaveLength(1);
  });

  it("rejects the peer as a server error when the certificate check throws", async () => {
    const { send, received, certificateValidator } = await setup();
    const failure = new Error("validator unavailable");
    certificateValidator.validate.mockRejectedValue(failure);

    const result = await send();

    expect(result.error).toMatchObject({ code: "serverError", cause: failure });
    expect(received).toEqual([]);
  });

  it("resumes the session of a handshake whose certificate passed without checking again", async () => {
    const { send, certificateValidator } = await setup();
    certificateValidator.validate.mockResolvedValue({ ok: true });

    await send();
    const resumed = await send();

    expect(resumed).toEqual({ status: 200 });
    expect(certificateValidator.validate).toHaveBeenCalledTimes(1);
  });

  it("never resumes the session of a handshake whose certificate was rejected", async () => {
    const { send, certificateValidator } = await setup();
    certificateValidator.validate.mockResolvedValueOnce({ ok: false, code: "expired" }).mockResolvedValueOnce({ ok: true });

    await send();
    const next = await send();

    expect(next).toEqual({ status: 200 });
    expect(certificateValidator.validate).toHaveBeenCalledTimes(2);
  });

  it("resumes a session whose ticket arrived while its certificate was still being checked", async () => {
    const { send, certificateValidator } = await setup();
    certificateValidator.validate.mockImplementation(() => delay(100).then(() => ({ ok: true }) as const));

    await send();
    const resumed = await send();

    expect(resumed).toEqual({ status: 200 });
    expect(certificateValidator.validate).toHaveBeenCalledTimes(1);
  });

  it("never resumes a session whose ticket arrived before its certificate was rejected", async () => {
    const { send, certificateValidator } = await setup();
    certificateValidator.validate
      .mockImplementationOnce(() => delay(100).then(() => ({ ok: false, code: "expired" }) as const))
      .mockResolvedValueOnce({ ok: true });

    await send();
    const next = await send();

    expect(next).toEqual({ status: 200 });
    expect(certificateValidator.validate).toHaveBeenCalledTimes(2);
  });

  it("reports a socket as verifying only while its certificate is being checked", async () => {
    const { agent, send, certificateValidator } = await setup();
    const check = Promise.withResolvers<CertValidationResult>();
    certificateValidator.validate.mockReturnValue(check.promise);
    const sockets: TLSSocket[] = [];
    const createConnection = agent.createConnection.bind(agent);
    vi.spyOn(agent, "createConnection").mockImplementation(options => {
      const socket = createConnection(options) as TLSSocket;
      sockets.push(socket);
      return socket;
    });

    const pending = send();
    await vi.waitFor(() => expect(certificateValidator.validate).toHaveBeenCalled());

    expect(agent.isVerifying(sockets[0])).toBe(true);
    check.resolve({ ok: true });
    await pending;
    expect(agent.isVerifying(sockets[0])).toBe(false);
    expect(agent.isVerifying(null)).toBe(false);
  });

  async function setup() {
    const { cert, key } = await createX509CertPair({ commonName: "akash1provider" });
    const received: { authorization?: string; body: string }[] = [];
    const server = https.createServer({ key, cert: cert.toJSON() }, async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      received.push({ authorization: req.headers.authorization, body });
      res.end("ok");
    });
    await new Promise<void>(resolve => server.listen(0, resolve));
    const certificateValidator = mock<CertificateValidator>();
    const agent = new ProviderCertificateAgent({ rejectUnauthorized: false, certificateValidator, providerAddress: "akash1provider" });
    onTestFinished(() => {
      agent.destroy();
      server.closeAllConnections();
      server.close();
    });
    const url = `https://localhost:${(server.address() as AddressInfo).port}/`;
    const send = () =>
      new Promise<{ status?: number; error?: Error }>(resolve => {
        const req = https.request(url, { method: "POST", agent, headers: { Authorization: "Bearer token" } }, res => {
          res.resume();
          res.on("end", () => resolve({ status: res.statusCode }));
        });
        req.on("error", error => resolve({ error }));
        req.end("manifest");
      });

    return { agent, send, received, certificateValidator };
  }
});

describe(verifyProviderCertificate.name, () => {
  it("accepts a peer whose certificate chains to a trusted authority without checking the chain", async () => {
    const { certificateValidator, socket } = setup({ authorized: true });

    await expect(verifyProviderCertificate(socket, certificateValidator, "akash1provider")).resolves.toEqual({ ok: true });
    expect(certificateValidator.validate).not.toHaveBeenCalled();
  });

  it("accepts a resumed session without checking the chain", async () => {
    const { certificateValidator, socket } = setup({ sessionReused: true });

    await expect(verifyProviderCertificate(socket, certificateValidator, "akash1provider")).resolves.toEqual({ ok: true });
    expect(certificateValidator.validate).not.toHaveBeenCalled();
  });

  it("rejects a full handshake that presented no certificate", async () => {
    const { certificateValidator, socket } = setup({ certificate: undefined });

    await expect(verifyProviderCertificate(socket, certificateValidator, "akash1provider")).resolves.toEqual({ ok: false, code: "noCertificate" });
  });

  it("checks any other certificate against the provider's address", async () => {
    const certificate = mock<X509Certificate>();
    const { certificateValidator, socket } = setup({ certificate });
    certificateValidator.validate.mockResolvedValue({ ok: false, code: "unknownCertificate" });

    await expect(verifyProviderCertificate(socket, certificateValidator, "akash1provider")).resolves.toEqual({ ok: false, code: "unknownCertificate" });
    expect(certificateValidator.validate).toHaveBeenCalledWith(certificate, "akash1provider");
  });

  function setup(input: { authorized?: boolean; sessionReused?: boolean; certificate?: X509Certificate }) {
    const certificateValidator = mock<CertificateValidator>();
    const socket = mock<Pick<TLSSocket, "authorized" | "isSessionReused" | "getPeerX509Certificate">>({
      authorized: input.authorized ?? false,
      isSessionReused: vi.fn().mockReturnValue(input.sessionReused ?? false),
      getPeerX509Certificate: vi.fn().mockReturnValue("certificate" in input ? input.certificate : mock<X509Certificate>())
    });

    return { certificateValidator, socket };
  }
});
