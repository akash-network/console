import { QueryCertificatesRequest, QueryCertificatesResponse, State } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { toBech32 } from "@cosmjs/encoding";
import type { X509Certificate } from "crypto";
import http2 from "http2";
import type { AddressInfo } from "net";

let grpcServer: http2.Http2Server | undefined;
const sessions: http2.ServerHttp2Session[] = [];

export function startChainApiServer(
  certificates: X509Certificate[],
  options?: GrpcServerOptions
): Promise<{
  close: () => Promise<void>;
  url: string;
}> {
  return new Promise(resolve => {
    const server = http2.createServer();

    server.on("session", session => {
      sessions.push(session);
    });

    server.on("stream", (stream, headers) => {
      if (options?.interceptRequest?.()) {
        stream.respond({
          ":status": 200,
          "content-type": "application/grpc+proto",
          "grpc-status": "14",
          "grpc-message": "unavailable"
        });
        stream.end();
        return;
      }

      const path = headers[":path"];

      if (path !== "/akash.cert.v1.Query/Certificates") {
        stream.respond({
          ":status": 404
        });
        stream.end("Not found");
        return;
      }

      const chunks: Buffer[] = [];
      stream.on("data", chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      stream.on("end", () => {
        const requestData = Buffer.concat(chunks);

        let requestedOwner: string | undefined;
        let requestedSerial: string | undefined;

        if (requestData.length > 5) {
          const protoData = requestData.slice(5);
          const certRequest = QueryCertificatesRequest.decode(protoData);
          requestedOwner = certRequest.filter?.owner;
          requestedSerial = certRequest.filter?.serial;
        }

        let cert: X509Certificate | undefined;
        if (requestedSerial || requestedOwner) {
          cert = certificates.find(cert => {
            const certOwner = cert.toLegacyObject().subject.CN;
            const serial = BigInt(`0x${cert.serialNumber}`).toString(10);

            const ownerMatches = !requestedOwner || certOwner === requestedOwner;
            const serialMatches = !requestedSerial || serial === requestedSerial;

            return ownerMatches && serialMatches;
          });
        }

        sendResponse(stream, buildCertificatesResponse(cert));
      });
    });

    server.listen(options?.port ?? 0, () => {
      grpcServer = server;
      resolve({
        url: `http://localhost:${(server.address() as AddressInfo).port}`,
        close: () =>
          new Promise<void>((resolve, reject) => {
            destroyAllSessions();

            server.close(error => {
              error ? reject(error) : resolve();
            });
          })
      });
    });
  });
}

export async function stopChainApiServer(): Promise<void> {
  if (!grpcServer?.listening) {
    return;
  }

  return new Promise<void>((resolve, reject) => {
    destroyAllSessions();

    grpcServer?.close(error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export interface GrpcServerOptions {
  port?: number;
  interceptRequest?: () => boolean;
}

export function generateBech32() {
  const addressData = new Uint8Array(20);

  for (let i = 0; i < 20; i++) {
    addressData[i] = Math.floor(Math.random() * 256);
  }

  return toBech32("akash", addressData);
}

function destroyAllSessions() {
  let session;
  while ((session = sessions.pop())) {
    session.destroy();
  }
}

function getCertificates(cert?: X509Certificate) {
  if (!cert) {
    return [];
  }

  const certPem = cert.toString();
  const pubkey = cert.publicKey.export({ type: "spki", format: "pem" }) as string;
  const serial = BigInt(`0x${cert.serialNumber}`).toString(10);

  return [
    {
      certificate: {
        cert: Buffer.from(certPem, "utf8"),
        pubkey: Buffer.from(pubkey, "utf8"),
        state: State.valid
      },
      serial: serial
    }
  ];
}

function buildCertificatesResponse(cert?: X509Certificate): Buffer {
  const certificates = getCertificates(cert);

  return Buffer.from(
    QueryCertificatesResponse.encode(
      QueryCertificatesResponse.fromPartial({
        certificates,
        pagination: { total: certificates.length }
      })
    ).finish()
  );
}

function sendResponse(stream: http2.ServerHttp2Stream, response: Buffer) {
  const frame = Buffer.alloc(5 + response.length);
  frame.writeUInt8(0, 0);
  frame.writeUInt32BE(response.length, 1);
  response.copy(frame, 5);

  stream.respond({
    ":status": 200,
    "content-type": "application/grpc+proto",
    "grpc-status": "0"
  });
  stream.end(frame);
}
