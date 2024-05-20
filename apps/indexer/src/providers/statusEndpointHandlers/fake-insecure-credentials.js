"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeInsecureCredentials = void 0;
const channel_credentials_1 = require("@grpc/grpc-js/build/src/channel-credentials");
// TODO: get rid of it once on-chain certificates validation is implemented
//  Issue: https://github.com/akash-network/cloudmos/issues/170
class FakeInsecureCredentials extends channel_credentials_1.ChannelCredentials {
    static createInsecure() {
        return new FakeInsecureCredentials();
    }
    constructor() {
        super();
    }
    compose(callCredentials) {
        throw new Error("Cannot compose insecure credentials");
    }
    _getConnectionOptions() {
        return {
            secureContext: null,
            rejectUnauthorized: false
        };
    }
    _isSecure() {
        return false;
    }
    _equals(other) {
        return other instanceof FakeInsecureCredentials;
    }
}
exports.FakeInsecureCredentials = FakeInsecureCredentials;
//# sourceMappingURL=fake-insecure-credentials.js.map