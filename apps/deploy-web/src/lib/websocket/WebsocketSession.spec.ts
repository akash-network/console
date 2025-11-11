import { WebsocketSession } from "./WebsocketSession";

import { createWebsocketMock, dispatchWsEvent } from "@tests/unit/websocketMock";

describe(WebsocketSession.name, () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe("send", () => {
    it("creates websocket connection on first send", () => {
      const { websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });

      expect(websocketFactory).not.toHaveBeenCalled();
      session.send({ type: "test" });

      expect(websocketFactory).toHaveBeenCalled();
    });

    it("sends message immediately if websocket is already open", async () => {
      const { websocket, websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });

      session.send({ type: "test", data: "hello" }); // connect to socket first
      await dispatchWsEvent(websocket, new Event("open"));
      session.send({ type: "test", data: "world" });

      expect(websocket.send).toHaveBeenCalledWith(JSON.stringify({ type: "test", data: "hello" }));
      expect(websocket.send).toHaveBeenCalledWith(JSON.stringify({ type: "test", data: "world" }));
    });

    it("queues messages when websocket is not open", () => {
      const { websocket, websocketFactory } = setup({ readyState: WebSocket.CONNECTING });
      const session = new WebsocketSession({ websocketFactory });

      session.send({ type: "test1" });
      session.send({ type: "test2" });

      expect(websocket.send).not.toHaveBeenCalled();
    });

    it("sends queued messages after websocket opens", async () => {
      const { websocket, websocketFactory } = setup({ readyState: WebSocket.CONNECTING });
      const session = new WebsocketSession({ websocketFactory });

      session.send({ type: "test1" });
      session.send({ type: "test2" });

      Object.defineProperty(websocket, "readyState", { value: WebSocket.OPEN, writable: true });
      await dispatchWsEvent(websocket, new Event("open"));

      expect(websocket.send).toHaveBeenCalledTimes(2);
      expect(websocket.send).toHaveBeenNthCalledWith(1, JSON.stringify({ type: "test1" }));
      expect(websocket.send).toHaveBeenNthCalledWith(2, JSON.stringify({ type: "test2" }));
    });

    it("uses custom `transformSentMessage` option", async () => {
      const { websocket, websocketFactory } = setup();
      const transformSentMessage = jest.fn(msg => `custom:${JSON.stringify(msg)}`);
      const session = new WebsocketSession({ websocketFactory, transformSentMessage });

      session.send({ type: "test" });
      await dispatchWsEvent(websocket, new Event("open"));

      expect(transformSentMessage).toHaveBeenCalledWith({ type: "test" });
      expect(websocket.send).toHaveBeenCalledWith('custom:{"type":"test"}');
    });

    it("only creates websocket connection once for multiple sends", async () => {
      const { websocket, websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });

      await dispatchWsEvent(websocket, new Event("open"));
      session.send({ type: "test1" });
      session.send({ type: "test2" });
      session.send({ type: "test3" });

      expect(websocketFactory).toHaveBeenCalledTimes(1);
    });
  });

  describe("receive", () => {
    it("creates websocket connection on first receive", async () => {
      const { websocket, websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });

      const generator = session.receive();
      const receivePromise = generator.next();

      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new CloseEvent("close"));
      await receivePromise;

      expect(websocketFactory).toHaveBeenCalled();
    });

    it("yields transformed messages", async () => {
      const { websocket, websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });
      const generator = session.receive();

      const result1Promise = generator.next();
      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"msg1"}' }));
      const result1 = await result1Promise;
      expect(result1.value).toEqual({ type: "msg1" });

      const result2Promise = generator.next();
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"msg2"}' }));
      const result2 = await result2Promise;
      expect(result2.value).toEqual({ type: "msg2" });

      const result3Promise = generator.next();
      await dispatchWsEvent(websocket, new CloseEvent("close"));
      const result3 = await result3Promise;
      expect(result3.done).toBe(true);
    });

    it("uses custom transformReceivedMessage", async () => {
      const { websocket, websocketFactory } = setup();
      const transformReceivedMessage = jest.fn(msg => ({ transformed: msg }));
      const session = new WebsocketSession({ websocketFactory, transformReceivedMessage });
      const generator = session.receive();

      const resultPromise = generator.next();
      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: "raw-message" }));
      const result = await resultPromise;

      expect(transformReceivedMessage).toHaveBeenCalledWith("raw-message");
      expect(result.value).toEqual({ transformed: "raw-message" });
    });

    it("filters messages using ignoreMessage option", async () => {
      const { websocket, websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });
      const generator = session.receive();

      const result1Promise = generator.next();
      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"ping"}' }));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"data","value":1}' }));
      const result1 = await result1Promise;
      expect(result1.value).toEqual({ type: "data", value: 1 });

      const result2Promise = generator.next();
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"pong"}' }));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"data","value":2}' }));
      const result2 = await result2Promise;
      expect(result2.value).toEqual({ type: "data", value: 2 });

      const result3Promise = generator.next();
      await dispatchWsEvent(websocket, new CloseEvent("close"));
      const result3 = await result3Promise;
      expect(result3.done).toBe(true);
    });

    it("uses custom ignoreMessage function", async () => {
      const { websocket, websocketFactory } = setup();
      const ignoreMessage = jest.fn((msg: unknown) => {
        if (msg && typeof msg === "object" && "type" in msg) {
          return msg.type === "ignore";
        }
        return false;
      });
      const session = new WebsocketSession({ websocketFactory, ignoreMessage });
      const generator = session.receive();

      const resultPromise = generator.next();
      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"ignore"}' }));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"keep"}' }));
      const result = await resultPromise;

      expect(ignoreMessage).toHaveBeenCalledWith({ type: "ignore" });
      expect(ignoreMessage).toHaveBeenCalledWith({ type: "keep" });
      expect(result.value).toEqual({ type: "keep" });
    });

    it("stops iteration when close event is dispatched", async () => {
      const { websocket, websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });
      const generator = session.receive();

      const resultPromise = generator.next();
      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new CloseEvent("close"));
      const result = await resultPromise;

      expect(result.done).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it("only creates websocket connection once for multiple receive calls", async () => {
      const { websocket, websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });

      const generator1 = session.receive();
      const result1Promise = generator1.next();
      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"msg1"}' }));
      await result1Promise;

      const generator2 = session.receive();
      const result2Promise = generator2.next();
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"msg2"}' }));
      await result2Promise;

      expect(websocketFactory).toHaveBeenCalledTimes(1);
    });
  });

  describe("disconnect", () => {
    it("closes websocket if it exists", async () => {
      const { websocket, websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });

      session.send({ type: "test" });
      await dispatchWsEvent(websocket, new Event("open"));

      session.disconnect();

      expect(websocket.close).toHaveBeenCalled();
    });

    it("clears websocket reference after disconnect", async () => {
      const { websocket, websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });

      await dispatchWsEvent(websocket, new Event("open"));
      session.send({ type: "test" });

      session.disconnect();

      session.send({ type: "queued" });

      expect(websocketFactory).toHaveBeenCalledTimes(2);
    });

    it("clears message queue on disconnect", async () => {
      const { websocket, websocketFactory } = setup({ readyState: WebSocket.CONNECTING });
      const session = new WebsocketSession({ websocketFactory });

      session.send({ type: "queued1" });
      session.send({ type: "queued2" });

      session.disconnect();

      Object.defineProperty(websocket, "readyState", { value: WebSocket.OPEN, writable: true });
      await dispatchWsEvent(websocket, new Event("open"));

      expect(websocket.send).not.toHaveBeenCalled();
    });

    it("does not throw if websocket does not exist", () => {
      const { websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });

      expect(() => session.disconnect()).not.toThrow();
    });
  });

  describe("connection lifecycle", () => {
    it("automatically cleans up on `close` event", async () => {
      const { websocket, websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });

      await dispatchWsEvent(websocket, new Event("open"));
      session.send({ type: "test" });

      await dispatchWsEvent(websocket, new CloseEvent("close"));

      session.send({ type: "new-message" });

      expect(websocketFactory).toHaveBeenCalledTimes(2);
    });
  });

  describe("default message filtering", () => {
    it("filters out ping messages by default", async () => {
      const { websocket, websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });
      const generator = session.receive();

      const resultPromise = generator.next();
      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"ping"}' }));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"data"}' }));
      const result = await resultPromise;

      expect(result.value).toEqual({ type: "data" });
    });

    it("filters out pong messages by default", async () => {
      const { websocket, websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });
      const generator = session.receive();

      const resultPromise = generator.next();
      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"pong"}' }));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"type":"data"}' }));
      const result = await resultPromise;

      expect(result.value).toEqual({ type: "data" });
    });
  });

  describe("integration scenarios", () => {
    it("handles send and receive simultaneously", async () => {
      const { websocket, websocketFactory } = setup();
      const session = new WebsocketSession({ websocketFactory });

      session.send({ command: "test" });
      await dispatchWsEvent(websocket, new Event("open"));

      const generator = session.receive();
      const responsePromise = generator.next();
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: '{"response":"ok"}' }));
      const response = await responsePromise;

      expect(websocket.send).toHaveBeenCalledWith('{"command":"test"}');
      expect(response.value).toEqual({ response: "ok" });
    });

    it("reconnects after disconnect", async () => {
      let ws: WebSocket;
      const websocketFactory = jest.fn(() => (ws = createWebsocketMock()));
      const session = new WebsocketSession({ websocketFactory });

      session.send({ type: "first" });
      await dispatchWsEvent(ws!, new Event("open"));
      expect(ws!.send).toHaveBeenCalledWith('{"type":"first"}');
      Object.assign(ws!, { used: true });

      await session.disconnect();

      session.send({ type: "second" });
      await dispatchWsEvent(ws!, new Event("open"));
      expect(ws!.send).toHaveBeenCalledWith('{"type":"second"}');

      expect(websocketFactory).toHaveBeenCalledTimes(2);
    });
  });

  function setup(options?: { readyState?: WebSocket["readyState"] }) {
    const websocket = createWebsocketMock();
    if (options?.readyState !== undefined) {
      Object.defineProperty(websocket, "readyState", {
        value: options.readyState,
        writable: true
      });
    }

    const websocketFactory = jest.fn(() => websocket);

    return { websocket, websocketFactory };
  }
});
