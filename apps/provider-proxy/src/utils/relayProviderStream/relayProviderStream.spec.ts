import { describe, expect, it, vi } from "vitest";

import { relayProviderStream } from "./relayProviderStream";

describe(relayProviderStream.name, () => {
  it("relays every provider chunk in order, then closes", async () => {
    const { relayed } = setup({ source: streamOf(["a", "b", "c"]) });

    expect(await readAll(relayed)).toEqual(["a", "b", "c"]);
  });

  it("reads from the provider only as far ahead as the caller's buffer while the caller is not reading", async () => {
    let pulls = 0;
    const source = new ReadableStream<string>(
      {
        pull(controller) {
          pulls++;
          controller.enqueue("chunk");
        }
      },
      { highWaterMark: 0 }
    );
    setup({ source });

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(pulls).toBe(1);
  });

  it("reads the next provider chunk once the caller reads", async () => {
    let pulls = 0;
    const source = new ReadableStream<string>(
      {
        pull(controller) {
          pulls++;
          controller.enqueue(`chunk-${pulls}`);
        }
      },
      { highWaterMark: 0 }
    );
    const { relayed } = setup({ source });
    const reader = relayed.getReader();

    const first = await reader.read();
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(first.value).toBe("chunk-1");
    expect(pulls).toBe(2);
  });

  it("ends without an error when the provider connection resets after the caller disconnected", async () => {
    const abortController = new AbortController();
    abortController.abort();
    const { relayed } = setup({ source: failingStream(connectionReset()), clientAbortSignal: abortController.signal });

    expect(await readAll(relayed)).toEqual([]);
  });

  it("fails when the provider connection resets while the caller is still connected", async () => {
    const error = connectionReset();
    const { relayed } = setup({ source: failingStream(error) });

    await expect(readAll(relayed)).rejects.toBe(error);
  });

  it("fails on any other provider error after the caller disconnected", async () => {
    const abortController = new AbortController();
    abortController.abort();
    const error = Object.assign(new Error("socket hang up"), { code: "ETIMEDOUT" });
    const { relayed } = setup({ source: failingStream(error), clientAbortSignal: abortController.signal });

    await expect(readAll(relayed)).rejects.toBe(error);
  });

  it("cancels the provider stream when the caller cancels", async () => {
    const cancel = vi.fn();
    const source = new ReadableStream<string>({ cancel }, { highWaterMark: 0 });
    const { relayed } = setup({ source });

    await relayed.cancel("caller left");

    expect(cancel).toHaveBeenCalledWith("caller left");
  });

  async function readAll(stream: ReadableStream<string>) {
    const reader = stream.getReader();
    const chunks: string[] = [];
    for (let result = await reader.read(); !result.done; result = await reader.read()) {
      chunks.push(result.value);
    }
    return chunks;
  }

  function streamOf(chunks: string[]) {
    return new ReadableStream<string>({
      start(controller) {
        chunks.forEach(chunk => controller.enqueue(chunk));
        controller.close();
      }
    });
  }

  function failingStream(error: Error) {
    return new ReadableStream<string>({
      pull() {
        throw error;
      }
    });
  }

  function connectionReset() {
    return Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
  }

  function setup(input: { source: ReadableStream<string>; clientAbortSignal?: AbortSignal }) {
    const relayed = relayProviderStream(input.source, input.clientAbortSignal ?? new AbortController().signal);
    return { relayed };
  }
});
