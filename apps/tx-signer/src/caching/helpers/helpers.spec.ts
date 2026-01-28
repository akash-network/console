import { memoizeAsync } from "./helpers";

describe(memoizeAsync.name, () => {
  it("memoizes successful results", async () => {
    const fn = jest.fn().mockResolvedValue("result");
    const memoized = memoizeAsync(fn);

    const result1 = await memoized();
    const result2 = await memoized();

    expect(result1).toBe("result");
    expect(result2).toBe("result");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not cache rejected promises", async () => {
    const error = new Error("Test error");
    const fn = jest.fn().mockRejectedValue(error);
    const memoized = memoizeAsync(fn);

    await expect(memoized()).rejects.toThrow("Test error");
    await expect(memoized()).rejects.toThrow("Test error");

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
