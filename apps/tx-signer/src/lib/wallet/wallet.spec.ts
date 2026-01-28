import { Wallet } from "./wallet";

describe(Wallet.name, () => {
  it("creates a wallet address with akash prefix", async () => {
    const wallet = new Wallet();
    const address = await wallet.getFirstAddress();

    expect(address.startsWith("akash")).toBe(true);
  });
});
