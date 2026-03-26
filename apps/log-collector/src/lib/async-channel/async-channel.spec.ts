import { AsyncChannel } from "./async-channel";

describe(AsyncChannel.name, () => {
  it("should deliver pushed values to async iterator", async () => {
    const channel = new AsyncChannel<string>();

    channel.push("a");
    channel.push("b");
    channel.close();

    const results: string[] = [];
    for await (const value of channel) {
      results.push(value);
    }

    expect(results).toEqual(["a", "b"]);
  });

  it("should wait for push when iterator is ahead of producer", async () => {
    const channel = new AsyncChannel<number>();

    const promise = channel[Symbol.asyncIterator]().next();

    channel.push(42);

    const result = await promise;
    expect(result).toEqual({ value: 42, done: false });
  });

  it("should return done when closed with no pending values", async () => {
    const channel = new AsyncChannel<string>();

    const promise = channel[Symbol.asyncIterator]().next();

    channel.close();

    const result = await promise;
    expect(result.done).toBe(true);
  });

  it("should drain buffered values before signaling done", async () => {
    const channel = new AsyncChannel<string>();

    channel.push("first");
    channel.push("second");
    channel.close();

    const iter = channel[Symbol.asyncIterator]();

    expect(await iter.next()).toEqual({ value: "first", done: false });
    expect(await iter.next()).toEqual({ value: "second", done: false });
    expect((await iter.next()).done).toBe(true);
  });

  it("should ignore pushes after close", async () => {
    const channel = new AsyncChannel<string>();

    channel.push("before");
    channel.close();
    channel.push("after");

    const results: string[] = [];
    for await (const value of channel) {
      results.push(value);
    }

    expect(results).toEqual(["before"]);
  });

  it("should work with yield* delegation", async () => {
    const channel = new AsyncChannel<number>();

    async function* consume(): AsyncGenerator<number> {
      yield* channel;
    }

    const gen = consume();

    channel.push(1);
    channel.push(2);

    expect(await gen.next()).toEqual({ value: 1, done: false });
    expect(await gen.next()).toEqual({ value: 2, done: false });

    channel.close();

    expect((await gen.next()).done).toBe(true);
  });
});
