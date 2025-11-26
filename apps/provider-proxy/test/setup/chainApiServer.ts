import { QueryCertificatesRequest } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { toBech32 } from "@cosmjs/encoding";
import type { X509Certificate } from "crypto";
import http2 from "http2";
import type { AddressInfo } from "net";

let grpcServer: http2.Http2Server | undefined;
const sessions: http2.ServerHttp2Session[] = [];

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return Buffer.from(bytes);
}

function encodeString(str: string): Buffer {
  const strBuf = Buffer.from(str, "utf8");
  return Buffer.concat([encodeVarint(strBuf.length), strBuf]);
}

function encodeField(fieldNum: number, wireType: number, data: Buffer): Buffer {
  const tag = (fieldNum << 3) | wireType;
  return Buffer.concat([encodeVarint(tag), data]);
}

function encodeLengthDelimited(data: Buffer): Buffer {
  return Buffer.concat([encodeVarint(data.length), data]);
}

function encodeCertificateResponse(serial: string, certPem: string, pubkey: string): Buffer {
  const certBytes = Buffer.from(certPem, "utf8");
  const pubkeyBytes = Buffer.from(pubkey, "utf8");

  const certificateMsg = Buffer.concat([
    encodeField(2, 0, encodeVarint(1)),
    encodeField(3, 2, encodeLengthDelimited(certBytes)),
    encodeField(4, 2, encodeLengthDelimited(pubkeyBytes))
  ]);

  return Buffer.concat([encodeField(1, 2, encodeLengthDelimited(certificateMsg)), encodeField(2, 2, encodeString(serial))]);
}

function encodePageResponse(total: number): Buffer {
  return encodeField(5, 0, encodeVarint(total));
}

export function startChainApiServer(
  certificates: X509Certificate[],
  options?: GrpcServerOptions
): Promise<{
  close: () => Promise<void>;
  url: string;
}> {
  return new Promise(resolve => {
    const server = http2.createServer();

    server.on("session", x => {
      sessions.push(x);
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

        if (!cert) {
          const message = encodeField(2, 2, encodePageResponse(0));
          const frame = Buffer.alloc(5 + message.length);
          frame.writeUInt8(0, 0);
          frame.writeUInt32BE(message.length, 1);
          message.copy(frame, 5);

          stream.respond({
            ":status": 200,
            "content-type": "application/grpc+proto",
            "grpc-status": "0"
          });
          stream.end(frame);
          return;
        }

        const certPem = cert.toString();
        const pubkey = cert.publicKey.export({ type: "spki", format: "pem" }) as string;
        const serial = BigInt(`0x${cert.serialNumber}`).toString(10);

        const certResponse = encodeCertificateResponse(serial, certPem, pubkey);
        const pageResponse = encodePageResponse(1);

        const message = Buffer.concat([encodeField(1, 2, encodeLengthDelimited(certResponse)), encodeField(2, 2, encodeLengthDelimited(pageResponse))]);

        const frame = Buffer.alloc(5 + message.length);
        frame.writeUInt8(0, 0);
        frame.writeUInt32BE(message.length, 1);
        message.copy(frame, 5);

        stream.respond({
          ":status": 200,
          "content-type": "application/grpc+proto",
          "grpc-status": "0"
        });
        stream.end(frame);
      });
    });

    server.listen(options?.port ?? 0, () => {
      grpcServer = server;
      resolve({
        url: `http://localhost:${(server.address() as AddressInfo).port}`,
        close: () =>
          new Promise<void>((resolve, reject) => {
            sessions.forEach(session => {
              session.destroy();
            });

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
    sessions.forEach(session => {
      session.destroy();
    });

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
