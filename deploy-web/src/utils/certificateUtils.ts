import rs from "jsrsasign";

export async function openCert(certPem: string, encryptedKeyPem: string) {
  if (!certPem || !encryptedKeyPem) return null;

  const key = rs.KEYUTIL.getKeyFromPlainPrivatePKCS8PEM(encryptedKeyPem);

  return {
    certPem,
    keyPem: rs.KEYUTIL.getPEM(key, "PKCS8PRV")
  };
}

export const getCertPem = certKey => {
  var c = new rs.X509();
  c.readCertPEM(certKey);
  var hSerial = c.getSerialNumberHex(); // '009e755e" hexadecimal string
  var sIssuer = c.getIssuerString(); // '/C=US/O=z2'
  var sSubject = c.getSubjectString(); // '/C=US/O=z2'
  var sNotBefore = c.getNotBefore(); // '100513235959Z'
  var sNotAfter = c.getNotAfter(); // '200513235959Z'

  return {
    hSerial,
    sIssuer,
    sSubject,
    sNotBefore,
    sNotAfter,
    issuedOn: strToDate(sNotBefore),
    expiresOn: strToDate(sNotAfter)
  };
};

export const generateCertificate = (address: string) => {
  const notBefore = new Date();
  let notAfter = new Date();
  notAfter.setFullYear(notBefore.getFullYear() + 1);

  const notBeforeStr = dateToStr(notBefore);
  const notAfterStr = dateToStr(notAfter);

  // STEP1. generate a key pair
  const kp = rs.KEYUTIL.generateKeypair("EC", "secp256r1");
  const prv = kp.prvKeyObj;
  const pub = kp.pubKeyObj;

  const encryptedKey = rs.KEYUTIL.getPEM(prv, "PKCS8PRV");

  const pubpem = rs.KEYUTIL.getPEM(pub, "PKCS8PUB").replaceAll("PUBLIC KEY", "EC PUBLIC KEY");

  // STEP2. specify certificate parameters
  const cert = new rs.KJUR.asn1.x509.Certificate({
    version: 3,
    serial: { int: Math.floor(new Date().getTime() * 1000) },
    issuer: { str: "/CN=" + address },
    notbefore: notBeforeStr,
    notafter: notAfterStr,
    subject: { str: "/CN=" + address },
    //subjectAltName: {array: [{oid: "2.23.133.2.6", value: "v0.0.1"}]},
    sbjpubkey: pub, // can specify public key object or PEM string
    ext: [
      { extname: "keyUsage", critical: true, names: ["keyEncipherment", "dataEncipherment"] },
      {
        extname: "extKeyUsage",
        array: [{ name: "clientAuth" }]
      },
      { extname: "basicConstraints", cA: true, critical: true }
    ],
    sigalg: "SHA256withECDSA",
    cakey: prv // can specify private key object or PEM string
  });

  const crtpem = cert.getPEM();

  return { cert, crtpem, pubpem, encryptedKey };
};

function dateToStr(date) {
  const year = date.getUTCFullYear().toString().substring(2).padStart(2, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const secs = date.getUTCSeconds().toString().padStart(2, "0");

  return `${year}${month}${day}${hours}${minutes}${secs}Z`;
}

/**
 * 230518223318Z into Date
 * @param {*} str
 * @returns Date
 */
function strToDate(str) {
  const year = parseInt(`20${str.substring(0, 2)}`);
  const month = parseInt(str.substring(2, 4)) - 1;
  const day = parseInt(str.substring(4, 6));
  const hours = parseInt(str.substring(6, 8));
  const minutes = parseInt(str.substring(8, 10));
  const secs = parseInt(str.substring(10, 12));

  return new Date(Date.UTC(year, month, day, hours, minutes, secs));
}
