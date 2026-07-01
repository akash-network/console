import crypto from "node:crypto";

/**
 * Parses and verifies the AMD KDS Certificate Revocation List (CRL).
 *
 * AMD publishes one CRL per product at `/vcek/v1/{product}/crl` (DER-encoded), issued and signed by
 * that product's ARK (root). It revokes intermediate (ASK) certificates by serial number — revoking
 * an ASK withdraws AMD's trust from every VCEK, and therefore every chip endorsement, beneath it.
 *
 * `node:crypto` exposes no CRL type, so we walk the `CertificateList` structure (RFC 5280 §5.1) by
 * hand: capture the signed `tbsCertList` bytes, the signature, `nextUpdate`, and the revoked serials,
 * then verify the signature with `node:crypto`. AMD signs these CRLs with RSA-PSS/SHA-384 (the ARK is
 * RSA-4096), which is the only algorithm {@link verifyCrlSignature} accepts.
 */

export interface ParsedAmdCrl {
  /** DER bytes of `tbsCertList` — exactly the region the signature covers. */
  readonly tbsDer: Buffer;
  /** Raw signature bytes (BIT STRING contents with the unused-bits octet stripped). */
  readonly signature: Buffer;
  /** `nextUpdate`, after which the CRL is stale; `null` when the (optional) field is absent. */
  readonly nextUpdate: Date | null;
  /** Revoked certificate serial numbers, canonicalised via {@link normalizeSerial}. */
  readonly revokedSerials: ReadonlySet<string>;
}

export class AmdCrlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmdCrlParseError";
  }
}

const TAG = {
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  SEQUENCE: 0x30,
  UTC_TIME: 0x17,
  GENERALIZED_TIME: 0x18
} as const;

interface Tlv {
  readonly tag: number;
  readonly contentStart: number;
  readonly contentEnd: number;
  /** Offset of the byte after this element — i.e. the start of its sibling. */
  readonly end: number;
}

/** Reads one DER tag-length-value element. AMD CRLs use only low-tag-number, definite-length forms. */
function readTlv(der: Buffer, offset: number): Tlv {
  if (offset + 2 > der.length) throw new AmdCrlParseError("Truncated DER element");
  const tag = der[offset];
  let length = der[offset + 1];
  let pos = offset + 2;
  if (length & 0x80) {
    const numBytes = length & 0x7f;
    if (numBytes === 0 || numBytes > 4) throw new AmdCrlParseError("Unsupported DER length encoding");
    length = 0;
    for (let i = 0; i < numBytes; i++) {
      if (pos >= der.length) throw new AmdCrlParseError("Truncated DER length");
      length = length * 256 + der[pos++];
    }
  }
  const contentEnd = pos + length;
  if (contentEnd > der.length) throw new AmdCrlParseError("DER element exceeds buffer");
  return { tag, contentStart: pos, contentEnd, end: contentEnd };
}

/** Canonicalises a serial (hex) for comparison: uppercase, leading zeros stripped (sign byte / padding). */
export function normalizeSerial(hex: string): string {
  const trimmed = hex.toUpperCase().replace(/^0+/, "");
  return trimmed === "" ? "0" : trimmed;
}

function parseAsn1Time(tag: number, content: Buffer): Date {
  const isUtc = tag === TAG.UTC_TIME;
  // RFC 5280 requires the fully-specified Zulu form: YYMMDDHHMMSSZ / YYYYMMDDHHMMSSZ. Reject anything
  // else so a malformed time fails closed (the caller treats a missing freshness bound as unverifiable).
  const pattern = isUtc ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/ : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/;
  const match = pattern.exec(content.toString("latin1"));
  if (!match) throw new AmdCrlParseError("Malformed CRL time");
  const rawYear = Number(match[1]);
  // RFC 5280: UTCTime years 00–49 map to 2000–2049, 50–99 to 1950–1999.
  const year = isUtc ? (rawYear < 50 ? 2000 + rawYear : 1900 + rawYear) : rawYear;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  // Date.UTC silently rolls over out-of-range parts (month 13 → next year, day 00 → prior month);
  // round-trip the components so such a time is rejected rather than yielding a plausible wrong date.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    throw new AmdCrlParseError("Malformed CRL time");
  }
  return date;
}

/**
 * Parses a DER-encoded AMD CRL. Walks `tbsCertList` positionally (RFC 5280 §5.1.2): optional version,
 * signature AlgorithmIdentifier, issuer, thisUpdate, optional nextUpdate, optional revokedCertificates.
 */
export function parseAmdCrl(der: Buffer): ParsedAmdCrl {
  const certificateList = readTlv(der, 0);
  if (certificateList.tag !== TAG.SEQUENCE) throw new AmdCrlParseError("CRL is not a SEQUENCE");

  const tbs = readTlv(der, certificateList.contentStart);
  if (tbs.tag !== TAG.SEQUENCE) throw new AmdCrlParseError("tbsCertList is not a SEQUENCE");
  const tbsDer = der.subarray(certificateList.contentStart, tbs.end);

  const signatureAlgorithm = readTlv(der, tbs.end);
  const signatureValue = readTlv(der, signatureAlgorithm.end);
  if (signatureValue.tag !== TAG.BIT_STRING) throw new AmdCrlParseError("Missing CRL signature");
  // A BIT STRING's first content octet counts unused trailing bits (0 for a byte-aligned signature).
  const signature = der.subarray(signatureValue.contentStart + 1, signatureValue.contentEnd);

  let cursor = tbs.contentStart;
  const next = (): Tlv | null => (cursor < tbs.contentEnd ? readTlv(der, cursor) : null);
  const skip = (element: Tlv | null): Tlv | null => {
    if (!element) return null;
    cursor = element.end;
    return next();
  };

  let field = next();
  if (field && field.tag === TAG.INTEGER) field = skip(field); // optional version
  field = skip(field); // signature AlgorithmIdentifier
  field = skip(field); // issuer
  field = skip(field); // thisUpdate

  let nextUpdate: Date | null = null;
  if (field && (field.tag === TAG.UTC_TIME || field.tag === TAG.GENERALIZED_TIME)) {
    nextUpdate = parseAsn1Time(field.tag, der.subarray(field.contentStart, field.contentEnd));
    field = skip(field);
  }

  const revokedSerials = new Set<string>();
  // The next element is `revokedCertificates` only when it is a SEQUENCE; otherwise it is the absent
  // (empty CRL) case or the `[0]` crlExtensions, neither of which we read.
  if (field && field.tag === TAG.SEQUENCE) {
    let entryPos = field.contentStart;
    while (entryPos < field.contentEnd) {
      const entry = readTlv(der, entryPos);
      const serial = readTlv(der, entry.contentStart); // userCertificate INTEGER (first field)
      revokedSerials.add(normalizeSerial(der.subarray(serial.contentStart, serial.contentEnd).toString("hex")));
      entryPos = entry.end;
    }
  }

  return { tbsDer, signature, nextUpdate, revokedSerials };
}

/**
 * Verifies the CRL signature against the issuer (the ARK). AMD always signs with RSA-PSS/SHA-384, so
 * that is the only accepted algorithm; any other issuer key or any error → `false`, so an unverifiable
 * CRL is never trusted.
 */
export function verifyCrlSignature(crl: ParsedAmdCrl, issuer: crypto.X509Certificate): boolean {
  try {
    const options = { key: issuer.publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_AUTO };
    return crypto.verify("sha384", crl.tbsDer, options, crl.signature);
  } catch {
    return false;
  }
}

/** True when the CRL lists the certificate's serial number as revoked. */
export function isCertRevoked(crl: ParsedAmdCrl, cert: crypto.X509Certificate): boolean {
  return crl.revokedSerials.has(normalizeSerial(cert.serialNumber));
}

/**
 * True when the CRL has no usable freshness bound (missing/invalid `nextUpdate`) or `now` is at/past
 * it. Fails closed: a CRL without a verifiable `nextUpdate` is treated as expired (→ revocation unknown).
 */
export function isCrlExpired(crl: ParsedAmdCrl, now: Date): boolean {
  // `parseAmdCrl` only ever yields `null` or a valid Date here (parseAsn1Time throws on a bad time),
  // so there is no non-finite case to guard against.
  return crl.nextUpdate === null || now.getTime() >= crl.nextUpdate.getTime();
}
