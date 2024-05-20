"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProvidersLocation = void 0;
const akash_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/akash");
const delay_1 = require("@src/shared/utils/delay");
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("dns/promises"));
const IpLookupDelay = 2000;
function getIpLocation(ip) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield axios_1.default.get(`http://ip-api.com/json/${ip}`);
        if (response.data.status !== "success") {
            throw new Error(`Could not get location for ip ${ip}`);
        }
        return {
            region: response.data.regionName,
            regionCode: response.data.region,
            country: response.data.country,
            countryCode: response.data.countryCode,
            lat: response.data.lat,
            lon: response.data.lon
        };
    });
}
function updateProvidersLocation() {
    return __awaiter(this, void 0, void 0, function* () {
        const providers = yield akash_1.Provider.findAll({
            where: {
                isOnline: true
            }
        });
        console.log(`${providers.length} providers to lookup`);
        for (const provider of providers) {
            try {
                const parsedUri = new URL(provider.hostUri);
                const ips = yield promises_1.default.resolve4(parsedUri.hostname);
                if (ips.length === 0) {
                    console.log(`Could not resolve ip for ${provider.hostUri}`);
                    continue;
                }
                const ip = ips.sort()[0]; // Always use the first ip
                if (provider.ip === ip) {
                    console.log(`Ip for ${provider.hostUri} is the same`);
                    continue;
                }
                const location = yield getIpLocation(ip);
                console.log(`${provider.hostUri} ip lookup: ${location.region}, ${location.country}`);
                if (location) {
                    yield provider.update({
                        ip: ip,
                        ipRegion: location.region,
                        ipRegionCode: location.regionCode,
                        ipCountry: location.country,
                        ipCountryCode: location.countryCode,
                        ipLat: location.lat,
                        ipLon: location.lon
                    });
                }
                yield (0, delay_1.sleep)(IpLookupDelay);
            }
            catch (e) {
                console.error(e);
            }
        }
    });
}
exports.updateProvidersLocation = updateProvidersLocation;
//# sourceMappingURL=ipLocationProvider.js.map