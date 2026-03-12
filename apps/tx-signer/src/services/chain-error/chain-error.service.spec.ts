import { describe, expect, it } from "vitest";

import { ChainErrorService } from "./chain-error.service";

describe(ChainErrorService.name, () => {
  it("returns 400 for insufficient funds error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("insufficient funds: 10uakt is smaller than 20uakt")).toBe(400);
  });

  it("returns 400 for deposit too low error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("Deposit too low: minimum is 5000000uakt")).toBe(400);
  });

  it("returns 400 for deployment closed error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("Deployment closed")).toBe(400);
  });

  it("returns 400 for invalid coin denominations error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("invalid coin denominations")).toBe(400);
  });

  it("returns 400 for invalid gpu attributes error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("invalid gpu attributes")).toBe(400);
  });

  it("returns 400 for invalid deployment version error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("invalid: deployment version")).toBe(400);
  });

  it("returns 400 for invalid deployment hash error", () => {
    const { service } = setup();
    expect(
      service.getChainErrorStatus(
        "Query failed with (6): rpc error: code = Unknown desc = failed to execute message; message index: 0: Invalid: deployment hash"
      )
    ).toBe(400);
  });

  it("returns 400 for fee allowance expired error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("fee allowance expired")).toBe(400);
  });

  it("returns 400 for deployment exists error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("Deployment exists")).toBe(400);
  });

  it("returns 400 for invalid owner address error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("Invalid Owner Address: invalid address")).toBe(400);
  });

  it("returns 400 for bid not open error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("bid not open")).toBe(400);
  });

  it("returns 400 for order not open error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("order not open")).toBe(400);
  });

  it("returns 402 for insufficient balance error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("insufficient balance")).toBe(402);
  });

  it("returns 402 for insufficient balance in full chain error message", () => {
    const { service } = setup();
    expect(
      service.getChainErrorStatus(
        "Query failed with (6): rpc error: code = Unknown desc = failed to execute message; message index: 0: Deposit invalid: insufficient balance [cosmos/cosmos-sdk@v0.53.3/baseapp/baseapp.go:1051] with gas used: '52906': unknown request"
      )
    ).toBe(402);
  });

  it("returns 503 for bad status on response 502 error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("Bad status on response: 502")).toBe(503);
  });

  it("returns 503 for bad status on response 503 error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("Bad status on response: 503")).toBe(503);
  });

  it("returns 503 for bad status on response 504 error", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("Bad status on response: 504")).toBe(503);
  });

  it("returns undefined for non-matching errors", () => {
    const { service } = setup();
    expect(service.getChainErrorStatus("Failed to sign and broadcast transaction")).toBeUndefined();
  });

  function setup() {
    const service = new ChainErrorService();
    return { service };
  }
});
