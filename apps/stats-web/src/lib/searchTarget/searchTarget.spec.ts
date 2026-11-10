import { toBech32 } from "@cosmjs/encoding";
import { describe, expect, it } from "vitest";

import { toSearchTarget } from "./searchTarget";

describe(toSearchTarget.name, () => {
  const accountAddress = toBech32("akash", new Uint8Array(20).fill(7));
  const validatorAddress = toBech32("akashvaloper", new Uint8Array(20).fill(9));

  it("finds a block by its height", () => {
    expect(toSearchTarget("31284786")).toEqual({ type: "block", height: 31284786 });
  });

  it("finds a transaction by its hash in upper case", () => {
    const hash = "ab".repeat(32);

    expect(toSearchTarget(hash)).toEqual({ type: "transaction", hash: hash.toUpperCase() });
  });

  it("finds an account by its address", () => {
    expect(toSearchTarget(accountAddress)).toEqual({ type: "address", address: accountAddress });
  });

  it("finds a validator by its operator address", () => {
    expect(toSearchTarget(validatorAddress)).toEqual({ type: "validator", address: validatorAddress });
  });

  it("normalizes an upper case address", () => {
    expect(toSearchTarget(accountAddress.toUpperCase())).toEqual({ type: "address", address: accountAddress });
  });

  it("ignores the surrounding whitespace", () => {
    expect(toSearchTarget("  42  ")).toEqual({ type: "block", height: 42 });
  });

  it.each(["", "   ", "12a", "ab".repeat(31), "ab".repeat(33), "cosmos1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu", "akash1notavalidaddress"])(
    "finds nothing for %j",
    search => {
      expect(toSearchTarget(search)).toBeNull();
    }
  );

  it("finds nothing for an address of another chain", () => {
    expect(toSearchTarget(toBech32("cosmos", new Uint8Array(20).fill(7)))).toBeNull();
  });
});
