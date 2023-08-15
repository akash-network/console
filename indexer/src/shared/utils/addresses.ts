import { ripemd160, sha256 } from "@cosmjs/crypto";
import { fromBech32 } from "@cosmjs/encoding";

export function isValidBech32Address(address: string, prefix?: string) {
  const bech32 = parseBech32(address);

  return bech32 && (!prefix || bech32.prefix === prefix);
}

export function parseBech32(str: string) {
  try {
    return fromBech32(str);
  } catch {
    return null;
  }
}

// FROM https://github.com/cosmos/cosmjs/blob/79396bfaa49831127ccbbbfdbb1185df14230c63/packages/tendermint-rpc/src/addresses.ts
export function rawSecp256k1PubkeyToRawAddress(pubkeyData: Uint8Array): Uint8Array {
  if (pubkeyData.length !== 33) {
    throw new Error(`Invalid Secp256k1 pubkey length (compressed): ${pubkeyData.length}`);
  }
  return ripemd160(sha256(pubkeyData));
}

// FROM https://github.com/cosmos/cosmjs/blob/79396bfaa49831127ccbbbfdbb1185df14230c63/packages/tendermint-rpc/src/addresses.ts
export function rawEd25519PubkeyToRawAddress(pubkeyData: Uint8Array): Uint8Array {
  if (pubkeyData.length !== 32) {
    throw new Error(`Invalid Ed25519 pubkey length: ${pubkeyData.length}`);
  }
  return sha256(pubkeyData).slice(0, 20);
}

// For secp256k1 this assumes we already have a compressed pubkey.
export function pubkeyToRawAddress(type: string, data: Uint8Array): Uint8Array {
  switch (type) {
    case "/cosmos.crypto.ed25519.PubKey":
      return rawEd25519PubkeyToRawAddress(data);
    case "/cosmos.crypto.secp256k1.PubKey":
      return rawSecp256k1PubkeyToRawAddress(data);
    default:
      // Keep this case here to guard against new types being added but not handled
      throw new Error(`Pubkey type ${type} not supported`);
  }
}
