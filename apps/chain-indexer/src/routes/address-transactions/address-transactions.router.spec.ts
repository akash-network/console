import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { createApp } from "@src/app";
import { AddressTransactionsService } from "@src/services/address-transactions/address-transactions.service";

const ADDRESS = "akash1xvavd9cad6cxk4k3ac8jwsahfwp4xlwe2s08nv";

describe("addressTransactionsRouter", () => {
  it("returns the address's page of transactions", async () => {
    const { app, addressTransactions } = setup();
    const page = { total: 1, transactions: [] };
    addressTransactions.list.mockResolvedValue(page);

    const response = await app.request(`/v1/addresses/${ADDRESS}/transactions?skip=10&limit=5`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: page });
    expect(addressTransactions.list).toHaveBeenCalledWith(ADDRESS, { skip: 10, limit: 5 });
  });

  it("defaults to the first 20 transactions", async () => {
    const { app, addressTransactions } = setup();
    addressTransactions.list.mockResolvedValue({ total: 0, transactions: [] });

    await app.request(`/v1/addresses/${ADDRESS}/transactions`);

    expect(addressTransactions.list).toHaveBeenCalledWith(ADDRESS, { skip: 0, limit: 20 });
  });

  it("rejects an address that is not an akash account address", async () => {
    const { app, addressTransactions } = setup();

    const response = await app.request("/v1/addresses/cosmos1abc/transactions");

    expect(response.status).toBe(400);
    expect(addressTransactions.list).not.toHaveBeenCalled();
  });

  function setup() {
    const addressTransactions = mock<AddressTransactionsService>();
    container.registerInstance(AddressTransactionsService, addressTransactions);
    return { app: createApp(), addressTransactions };
  }
});
