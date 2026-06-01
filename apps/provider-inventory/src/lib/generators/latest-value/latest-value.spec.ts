import { describe, expect, it } from "vitest";

import { latestValue } from "./latest-value";

describe("latestValue", () => {
  it("yields a value set before iteration begins", async () => {
    const cell = latestValue<number>();
    cell.set(1);
    cell.close();

    const values = await collect(cell);

    expect(values).toEqual([1]);
  });

  it("waits for a value to be set before yielding", async () => {
    const cell = latestValue<number>();
    const iterator = cell[Symbol.asyncIterator]();
    const next = iterator.next();

    cell.set(7);

    await expect(next).resolves.toEqual({ value: 7, done: false });
  });

  it("drops intermediate values, keeping only the latest between reads", async () => {
    const cell = latestValue<number>();
    cell.set(1);
    cell.set(2);
    cell.set(3);
    cell.close();

    const values = await collect(cell);

    expect(values).toEqual([3]);
  });

  it("consumes the value so a second read waits for a fresh one", async () => {
    const cell = latestValue<number>();
    const iterator = cell[Symbol.asyncIterator]();

    cell.set(1);
    await iterator.next();
    const pending = iterator.next();
    cell.set(2);

    await expect(pending).resolves.toEqual({ value: 2, done: false });
  });

  it("ends iteration when closed with no pending value", async () => {
    const cell = latestValue<number>();
    cell.close();

    const values = await collect(cell);

    expect(values).toEqual([]);
  });

  it("flushes a pending value before ending when closed", async () => {
    const cell = latestValue<number>();
    cell.set(1);
    cell.set(2);
    cell.close();

    const values = await collect(cell);

    expect(values).toEqual([2]);
  });

  it("throws the failure after iteration is closed with fail", async () => {
    const cell = latestValue<number>();
    cell.fail(new Error("boom"));

    await expect(collect(cell)).rejects.toThrow("boom");
  });

  it("ignores values set after the cell is closed", async () => {
    const cell = latestValue<number>();
    cell.close();
    cell.set(99);

    const values = await collect(cell);

    expect(values).toEqual([]);
  });

  it("ends iteration promptly once the signal is aborted", async () => {
    const controller = new AbortController();
    const cell = latestValue<number>({ signal: controller.signal });
    const iterator = cell[Symbol.asyncIterator]();
    const next = iterator.next();

    controller.abort();

    await expect(next).resolves.toEqual({ value: undefined, done: true });
  });

  async function collect<T>(cell: AsyncIterable<T>) {
    const values: T[] = [];
    for await (const value of cell) values.push(value);
    return values;
  }
});
