import { LoggerService } from "@akashnetwork/logging";

const logger = LoggerService.forContext("Files");

export const bytesToHumanReadableSize = function (bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  if (bytes == 0) {
    return "n/a";
  }

  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());

  if (i == 0) {
    return bytes + " " + sizes[i];
  }

  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + sizes[i];
};

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

export function parseSizeStr(str: string) {
  try {
    const suffix = Object.keys(specSuffixes).find(s => str.toLowerCase().endsWith(s.toLowerCase()));

    if (suffix) {
      const suffixPos = str.length - suffix.length;
      const numberStr = str.substring(0, suffixPos);
      return parseFloat(numberStr) * specSuffixes[suffix];
    } else {
      return parseFloat(str);
    }
  } catch (err) {
    logger.error(err);
    throw new Error("Error while parsing size: " + str);
  }
}

const kubernetesDecimalSuffixes = {
  m: 0.001,
  K: 1000,
  M: 1000 * 1000,
  G: 1000 * 1000 * 1000,
  T: 1000 * 1000 * 1000 * 1000,
  P: 1000 * 1000 * 1000 * 1000 * 1000,
  E: 1000 * 1000 * 1000 * 1000 * 1000 * 1000
};

export function parseDecimalKubernetesString(str: string) {
  try {
    const suffix = Object.keys(kubernetesDecimalSuffixes).find(s => str.endsWith(s));

    if (suffix) {
      const suffixPos = str.length - suffix.length;
      const numberStr = str.substring(0, suffixPos);
      return parseFloat(numberStr) * kubernetesDecimalSuffixes[suffix];
    } else {
      return parseFloat(str);
    }
  } catch (err) {
    logger.error(err);
    throw new Error("Error while parsing size: " + str);
  }
}
