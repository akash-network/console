import type { StripeService } from "@akashnetwork/http-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";
import { useTransactionInvoiceMutation } from "./useTransactionInvoiceQueries";

import { act } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const TRANSACTIONS_KEY = ["v1", "listStripeTransactions"];
const BILLING_DETAILS_KEY = ["v1", "getBillingDetails"];

describe(useTransactionInvoiceMutation.name, () => {
  it("returns the invoice PDF of the payment and refetches the history", async () => {
    const { result, stripe, queryClient, pdf } = setup();
    queryClient.setQueryData(TRANSACTIONS_KEY, { data: { transactions: [], totalCount: 0, hasMore: false } });
    queryClient.setQueryData(BILLING_DETAILS_KEY, { data: {} });

    const response = await act(() => result.current.mutateAsync("tx-1"));

    expect(stripe.downloadTransactionInvoice).toHaveBeenCalledWith("tx-1");
    expect(response).toBe(pdf);
    expect(queryClient.getQueryState(TRANSACTIONS_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(BILLING_DETAILS_KEY)?.isInvalidated).toBe(false);
  });

  it("leaves a refusal the button already shows out of error reporting", async () => {
    const { result, queryClient } = setup();

    await act(() => result.current.mutateAsync("tx-1"));

    const [mutation] = queryClient.getMutationCache().getAll();
    expect(mutation.meta).toEqual(SKIP_REPORTING_REFUSED_INPUT);
  });

  function setup() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const pdf = new Blob(["%PDF"], { type: "application/pdf" });
    const stripe = mock<StripeService>({ downloadTransactionInvoice: vi.fn().mockResolvedValue(pdf) });
    const listStripeTransactions = vi.fn().mockResolvedValue({ data: { transactions: [], totalCount: 0, hasMore: false } });
    const api = createProxy({ v1: { listStripeTransactions } }) as unknown as ApiService;

    const { result } = setupQuery(() => useTransactionInvoiceMutation(), {
      services: { api: () => api, stripe: () => stripe, queryClient: () => queryClient }
    });

    return { result, queryClient, stripe, pdf };
  }
});
