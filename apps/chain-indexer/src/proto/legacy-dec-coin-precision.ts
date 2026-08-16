import { DecCoin } from "@akashnetwork/akash-api/cosmos/base/v1beta1";
import { Reader } from "protobufjs/minimal";

/**
 * `@akashnetwork/akash-api` patches `DecCoin.decode` to convert the wire-format 1e18-scaled
 * atomics string into a human decimal via `parseInt(amount) / 1e18` — float64 math that corrupts
 * every legacy-era DecCoin at the ~15th significant digit (a v1beta2 bid price of `117.73952`
 * decodes as `117.739519999999999`). All legacy proto versions share this one module instance,
 * so replacing its `decode` with exact string math fixes v1beta1–v1beta4 decoding in one place.
 * Imported for its side effect by the type catalog before any registry decoding happens.
 */
export function installExactLegacyDecCoinDecode(): void {
  DecCoin.decode = decodeDecCoinExact;
}

const DENOM_FIELD = 1;
const AMOUNT_FIELD = 2;

function decodeDecCoinExact(input: Reader | Uint8Array, length?: number): DecCoin {
  const reader = input instanceof Uint8Array ? Reader.create(input) : input;
  const end = length === undefined ? reader.len : reader.pos + length;
  const message: DecCoin = { $type: DecCoin.$type, denom: "", amount: "" };

  while (reader.pos < end) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case DENOM_FIELD:
        message.denom = reader.string();
        break;
      case AMOUNT_FIELD:
        message.amount = decimalStringFromAtomics(reader.string());
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }

  return message;
}

function decimalStringFromAtomics(atomics: string): string {
  const negative = atomics.startsWith("-");
  const digits = (negative ? atomics.slice(1) : atomics).padStart(19, "0");
  const whole = digits.slice(0, -18);
  const fraction = digits.slice(-18).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

installExactLegacyDecCoinDecode();
