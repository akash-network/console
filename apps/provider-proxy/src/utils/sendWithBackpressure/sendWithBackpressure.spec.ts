import type { Socket } from "net";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";
import type WebSocket from "ws";

import { CLIENT_SEND_HIGH_WATER_BYTES, sendWithBackpressure } from "./sendWithBackpressure";

describe(sendWithBackpressure.name, () => {
  it("sends the data to the client", () => {
    const { client, provider } = setup({ bufferedAmount: 0 });

    sendWithBackpressure(client, "message", provider);

    expect(client.send).toHaveBeenCalledWith("message", expect.any(Function));
  });

  it("keeps reading from the provider while the client's backlog is at the high-water mark", () => {
    const { client, provider } = setup({ bufferedAmount: CLIENT_SEND_HIGH_WATER_BYTES });

    sendWithBackpressure(client, "message", provider);

    expect(provider.pause).not.toHaveBeenCalled();
  });

  it("pauses the provider once the client's backlog passes the high-water mark", () => {
    const { client, provider } = setup({ bufferedAmount: CLIENT_SEND_HIGH_WATER_BYTES + 1 });

    sendWithBackpressure(client, "message", provider);

    expect(provider.pause).toHaveBeenCalled();
  });

  it("resumes a paused provider once the client's backlog drains to the high-water mark", () => {
    const { client, provider, completeSend } = setup({ bufferedAmount: CLIENT_SEND_HIGH_WATER_BYTES + 1, isPaused: true });
    sendWithBackpressure(client, "message", provider);

    completeSend({ bufferedAmount: CLIENT_SEND_HIGH_WATER_BYTES });

    expect(provider.resume).toHaveBeenCalled();
  });

  it("keeps the provider paused while the client's backlog is still above the high-water mark", () => {
    const { client, provider, completeSend } = setup({ bufferedAmount: CLIENT_SEND_HIGH_WATER_BYTES + 1, isPaused: true });
    sendWithBackpressure(client, "message", provider);

    completeSend({ bufferedAmount: CLIENT_SEND_HIGH_WATER_BYTES + 1 });

    expect(provider.resume).not.toHaveBeenCalled();
  });

  it("leaves a provider that is not paused alone when a send completes", () => {
    const { client, provider, completeSend } = setup({ bufferedAmount: 0, isPaused: false });
    sendWithBackpressure(client, "message", provider);

    completeSend({ bufferedAmount: 0 });

    expect(provider.resume).not.toHaveBeenCalled();
  });

  it("still sends when the provider socket is not known yet", () => {
    const { client, completeSend } = setup({ bufferedAmount: CLIENT_SEND_HIGH_WATER_BYTES + 1 });

    sendWithBackpressure(client, "message", undefined);

    expect(client.send).toHaveBeenCalledWith("message", expect.any(Function));
    expect(() => completeSend({ bufferedAmount: 0 })).not.toThrow();
  });

  function setup(input: { bufferedAmount: number; isPaused?: boolean }) {
    const client = mock<WebSocket>({ bufferedAmount: input.bufferedAmount });
    const provider = mock<Socket>();
    provider.isPaused.mockReturnValue(input.isPaused ?? false);

    const completeSend = ({ bufferedAmount }: { bufferedAmount: number }) => {
      Object.assign(client, { bufferedAmount });
      const [, callback] = client.send.mock.calls[0] as unknown as [string, () => void];
      callback();
    };

    return { client, provider, completeSend };
  }
});
