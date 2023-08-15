import axios from "axios";
const stableStringify = require("json-stable-stringify");

export class CustomValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CustomValidationError";
  }
}

const specSuffixes = {
  Ki: 1024,
  Mi: 1024 * 1024,
  Gi: 1024 * 1024 * 1024,
  Ti: 1024 * 1024 * 1024 * 1024,
  Pi: 1024 * 1024 * 1024 * 1024 * 1024,
  Ei: 1024 * 1024 * 1024 * 1024 * 1024 * 1024,
  K: 1000,
  M: 1000 * 1000,
  G: 1000 * 1000 * 1000,
  T: 1000 * 1000 * 1000 * 1000,
  P: 1000 * 1000 * 1000 * 1000 * 1000,
  E: 1000 * 1000 * 1000 * 1000 * 1000 * 1000,
  Kb: 1000,
  Mb: 1000 * 1000,
  Gb: 1000 * 1000 * 1000,
  Tb: 1000 * 1000 * 1000 * 1000,
  Pb: 1000 * 1000 * 1000 * 1000 * 1000,
  Eb: 1000 * 1000 * 1000 * 1000 * 1000 * 1000
};

// Replicate the HTML escape logic from https://pkg.go.dev/encoding/json#Marshal
function escapeHtml(unsafe) {
  return unsafe.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

// https://github.com/ovrclk/akash/blob/04e7a7667dd94b5a15fa039e4f7df5c9ad93be4f/sdl/sdl.go#L120
export async function ManifestVersion(manifest) {
  var enc = new TextEncoder();
  let jsonStr = JSON.stringify(manifest);

  jsonStr = jsonStr.replaceAll('"quantity":{"val', '"size":{"val');
  jsonStr = jsonStr.replaceAll('"mount":', '"readOnlyTmp":');
  jsonStr = jsonStr.replaceAll('"readOnly":', '"mount":');
  jsonStr = jsonStr.replaceAll('"readOnlyTmp":', '"readOnly":');

  // console.log(jsonStr);
  // console.log(SortJSON(jsonStr));

  let sortedBytes = enc.encode(SortJSON(jsonStr));

  // console.log(sortedBytes);

  let sum = await crypto.subtle.digest("SHA-256", sortedBytes);

  let base64 = _arrayBufferToBase64(sum);

  return base64;
}

// https://github.com/cosmos/cosmos-sdk/blob/9fd866e3820b3510010ae172b682d71594cd8c14/types/utils.go#L29
export function SortJSON(jsonStr) {
  return escapeHtml(stableStringify(JSON.parse(jsonStr)));
}

function _arrayBufferToBase64(buffer) {
  var binary = "";
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function ParseServiceProtocol(input) {
  let result;

  // This is not a case sensitive parse, so make all input
  // uppercase
  if (input) {
    input = input.toUpperCase();
  }

  switch (input) {
    case "TCP":
    case "":
    case undefined: // The empty string (no input) implies TCP
      result = "TCP";
      break;
    case "UDP":
      result = "UDP";
      break;
    default:
      throw new CustomValidationError("Unsupported Service Protocol " + input);
  }

  return result;
}

export async function getCurrentHeight(apiEndpoint) {
  const response = await axios.get(`${apiEndpoint}/blocks/latest`);
  const data = response.data;

  const height = parseInt(data.block.header.height);
  return height;
}

export function parseSizeStr(str) {
  try {
    const suffix = Object.keys(specSuffixes).find((s) => str.toString().toLowerCase().endsWith(s.toLowerCase()));

    if (suffix) {
      const suffixPos = str.length - suffix.length;
      const numberStr = str.substring(0, suffixPos);
      return (parseFloat(numberStr) * specSuffixes[suffix]).toString();
    } else {
      return parseFloat(str);
    }
  } catch (err) {
    console.error(err);
    throw new Error("Error while parsing size: " + str);
  }
}

export function shouldBeIngress(expose) {
  return expose.proto === "TCP" && expose.global && 80 === exposeExternalPort(expose);
}

function exposeExternalPort(expose) {
  if (expose.externalPort === 0) {
    return expose.port;
  }

  return expose.externalPort;
}
