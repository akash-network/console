import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { SdlBuilderFormValuesType } from "@src/types";
import { useSdlEnv } from "./useSdlEnv";

import { act, renderHook } from "@testing-library/react";
import { buildSDLService } from "@tests/seeders/sdlService";

describe("useSdlEnv", () => {
  it("initializes with empty environment variables", async () => {
    const { result } = await setup();

    expect(result.current.values.API_KEY).toBeUndefined();
    expect(result.current.values.DATABASE_URL).toBeUndefined();
    expect(result.current.errors).toEqual({});
  });

  it("sets and gets environment variable values", async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.setValue("API_KEY", "secret-key-123");
      result.current.setValue("DATABASE_URL", "postgresql://localhost:5432/mydb");
    });

    expect(result.current.values.API_KEY).toBe("secret-key-123");
    expect(result.current.values.DATABASE_URL).toBe("postgresql://localhost:5432/mydb");
  });

  it("removes environment variable when value is empty", async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.setValue("API_KEY", "secret-key-123");
      result.current.setValue("API_KEY", "");
    });

    expect(result.current.values.API_KEY).toBe("");
  });

  it("updates existing environment variable", async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.setValue("API_KEY", "old-key");
      result.current.setValue("API_KEY", "new-key");
    });

    expect(result.current.values.API_KEY).toBe("new-key");
  });

  it("handles validation errors from schema", async () => {
    const { result, form } = await setup();

    await act(async () => {
      result.current.setValue("API_KEY", "");
      result.current.setValue("DATABASE_URL", "invalid-url");
    });

    await act(async () => {
      form.setError("services.0.env", { type: "manual", message: "invalid env" });
    });

    await act(async () => {
      form.handleSubmit(() => {});
    });

    expect(result.current.errors.API_KEY).toBe("API key is required");
    expect(result.current.errors.DATABASE_URL).toBe("Invalid database URL");
  });

  it("handles multiple environment variables correctly", async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.setValue("API_KEY", "key1");
      result.current.setValue("DATABASE_URL", "url1");
    });

    expect(result.current.values.API_KEY).toBe("key1");
    expect(result.current.values.DATABASE_URL).toBe("url1");
  });

  it("returns undefined for keys without values", async () => {
    const { result } = await setup();
    expect(result.current.values.DEBUG).toBeUndefined();
  });

  async function setup() {
    const testSchema = z.object({
      API_KEY: z.string().min(1, "API key is required"),
      DATABASE_URL: z.string().url("Invalid database URL"),
      DEBUG: z.boolean().optional()
    });

    let methods: UseFormReturn<SdlBuilderFormValuesType>;

    const TestWrapper = ({ children, defaultValues }: { children: React.ReactNode; defaultValues: SdlBuilderFormValuesType }) => {
      methods = useForm<SdlBuilderFormValuesType>({
        defaultValues
      });

      return <FormProvider {...methods}>{children}</FormProvider>;
    };

    const defaultFormValues: SdlBuilderFormValuesType = {
      services: [buildSDLService({ env: [] })],
      imageList: [],
      hasSSHKey: false
    };

    const { result } = renderHook(
      () =>
        useSdlEnv({
          serviceIndex: 0,
          schema: testSchema
        }),
      {
        wrapper: ({ children }) => <TestWrapper defaultValues={defaultFormValues}>{children}</TestWrapper>
      }
    );

    return {
      result,
      form: await vi.waitFor(() => methods)
    };
  }
});
