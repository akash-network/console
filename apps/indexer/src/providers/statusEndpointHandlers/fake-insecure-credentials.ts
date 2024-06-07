import { ChannelCredentials } from "@grpc/grpc-js/build/src/channel-credentials";
import { ConnectionOptions } from "tls";

// TODO: get rid of it once on-chain certificates validation is implemented
//  Issue: https://github.com/akash-network/cloudmos/issues/170
export class FakeInsecureCredentials extends ChannelCredentials {
  static createInsecure(): ChannelCredentials {
    return new FakeInsecureCredentials();
  }

  constructor() {
    super();
  }

  compose(): ChannelCredentials {
    throw new Error("Cannot compose insecure credentials");
  }

  _getConnectionOptions(): ConnectionOptions | null {
    return {
      secureContext: null,
      rejectUnauthorized: false
    };
  }
  _isSecure(): boolean {
    return false;
  }

  _equals(other: ChannelCredentials): boolean {
    return other instanceof FakeInsecureCredentials;
  }
}
