export const SIGNED_IN_USER_CHANNEL_NAME = "console-signed-in-user";

/** Tells the other tabs of this browser which user the Auth0 session they all share now belongs to. */
export class SignedInUserChannel {
  readonly #channel: BroadcastChannel;

  constructor(channel: BroadcastChannel) {
    this.#channel = channel;
  }

  announce(userId: string): void {
    this.#channel.postMessage(userId);
  }

  subscribe(listener: (userId: string) => void): () => void {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data === "string") listener(event.data);
    };
    this.#channel.addEventListener("message", onMessage);
    return () => {
      this.#channel.removeEventListener("message", onMessage);
    };
  }
}
