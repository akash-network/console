import { describe, expect, it } from "vitest";

import { mintFreshSecretName, mintFreshSecretNames } from "./mintFreshSecretName";

describe(mintFreshSecretName.name, () => {
  it("uses the preferred name when the stored SDL does not reference it", () => {
    expect(mintFreshSecretName("services:\n  web:\n    env:\n      - A=ac-secret://A\n", "HF_TOKEN")).toBe("HF_TOKEN");
  });

  it("picks a new name when the stored SDL already references it", () => {
    expect(mintFreshSecretName("services:\n  web:\n    env:\n      - HF_TOKEN=ac-secret://HF_TOKEN\n", "HF_TOKEN")).toBe("HF_TOKEN_2");
  });

  it("turns characters a secret name can't hold into underscores", () => {
    expect(mintFreshSecretName(null, "my-api.key")).toBe("my_api_key");
  });

  it("works without a stored SDL", () => {
    expect(mintFreshSecretName(undefined, "TOKEN")).toBe("TOKEN");
  });

  it("mints several names from one set, so they avoid the stored ones and each other", () => {
    expect(mintFreshSecretNames("services:\n  web:\n    env:\n      - A=ac-secret://TOKEN\n", ["TOKEN", "TOKEN", "OTHER"])).toEqual([
      "TOKEN_2",
      "TOKEN_3",
      "OTHER"
    ]);
  });
});
