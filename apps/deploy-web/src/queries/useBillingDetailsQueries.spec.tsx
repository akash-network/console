import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { BillingDetails, BillingDetailsInput } from "@src/types/billingDetails";
import { useBillingDetailsQuery, useUpdateBillingDetailsMutation } from "./useBillingDetailsQueries";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const BILLING_DETAILS_KEY = ["v1", "getBillingDetails"];

describe("useBillingDetailsQueries", () => {
  describe(useBillingDetailsQuery.name, () => {
    it("unwraps the billing details from the response envelope", async () => {
      const { result, getBillingDetails } = setup({ useHook: () => useBillingDetailsQuery() });

      await waitFor(() => expect(result.current.data).toEqual(SAVED));
      expect(getBillingDetails).toHaveBeenCalledOnce();
    });
  });

  describe(useUpdateBillingDetailsMutation.name, () => {
    it("saves the details and shows the saved version without refetching", async () => {
      const { result, updateBillingDetails, queryClient } = setup({ useHook: () => useUpdateBillingDetailsMutation() });
      queryClient.setQueryData(BILLING_DETAILS_KEY, { data: { legalName: null, address: null, taxId: null } });

      await act(() => result.current.mutateAsync({ data: INPUT }));

      expect(updateBillingDetails).toHaveBeenCalledWith({ data: INPUT });
      expect(queryClient.getQueryData(BILLING_DETAILS_KEY)).toEqual({ data: SAVED });
    });
  });

  function setup<T>(input: { useHook: () => T }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const getBillingDetails = vi.fn().mockResolvedValue({ data: SAVED });
    const updateBillingDetails = vi.fn().mockResolvedValue({ data: SAVED });
    const api = createProxy({ v1: { getBillingDetails, updateBillingDetails } }) as unknown as ApiService;

    const { result } = setupQuery(input.useHook, { services: { api: () => api, queryClient: () => queryClient } });

    return { result, queryClient, getBillingDetails, updateBillingDetails };
  }
});

const INPUT: BillingDetailsInput = {
  legalName: "Acme GmbH",
  address: { line1: "Hauptstr. 1", line2: null, city: "Berlin", state: null, postalCode: "10115", country: "DE" },
  taxId: { type: "eu_vat", value: "DE123456789" }
};

const SAVED: BillingDetails = {
  legalName: "Acme GmbH",
  address: { line1: "Hauptstr. 1", line2: null, city: "Berlin", state: null, postalCode: "10115", country: "DE" },
  taxId: { type: "eu_vat", value: "DE123456789", verificationStatus: "pending" }
};
