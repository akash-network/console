import { describe, expect, it, vi } from "vitest";

import { attemptEach } from "./attempt-each";

describe(attemptEach.name, () => {
  it("attempts every item in order", async () => {
    const { attempt, onFailure } = setup({});

    await attemptEach(["a", "b", "c"], attempt, onFailure);

    expect(attempt.mock.calls).toEqual([["a"], ["b"], ["c"]]);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("keeps attempting after a failure, reports each failure and rethrows the first", async () => {
    const firstError = new Error("first");
    const secondError = new Error("second");
    const { attempt, onFailure } = setup({ failures: { a: firstError, c: secondError } });

    await expect(attemptEach(["a", "b", "c"], attempt, onFailure)).rejects.toBe(firstError);

    expect(attempt.mock.calls).toEqual([["a"], ["b"], ["c"]]);
    expect(onFailure.mock.calls).toEqual([
      ["a", firstError],
      ["c", secondError]
    ]);
  });

  it("resolves when there is nothing to attempt", async () => {
    const { attempt, onFailure } = setup({});

    await expect(attemptEach([], attempt, onFailure)).resolves.toBeUndefined();

    expect(attempt).not.toHaveBeenCalled();
  });

  function setup(input: { failures?: Record<string, Error> }) {
    const attempt = vi.fn(async (item: string) => {
      const failure = input.failures?.[item];
      if (failure) throw failure;
    });
    const onFailure = vi.fn();

    return { attempt, onFailure };
  }
});
