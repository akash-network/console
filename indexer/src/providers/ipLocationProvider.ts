import { Provider } from "@src/../../shared/dbSchemas/akash";
import { sleep } from "@src/shared/utils/delay";
import axios from "axios";
import dns from "dns/promises";

const IpLookupDelay = 2_000;

async function getIpLocation(ip: string) {
  const response = await axios.get(`http://ip-api.com/json/${ip}`);

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
}

export async function updateProvidersLocation() {
  const providers = await Provider.findAll({
    where: {
      isOnline: true
    }
  });

  console.log(`${providers.length} providers to lookup`);

  for (const provider of providers) {
    try {
      const parsedUri = new URL(provider.hostUri);
      const ips = await dns.resolve4(parsedUri.hostname);

      if (ips.length === 0) {
        console.log(`Could not resolve ip for ${provider.hostUri}`);
        continue;
      }

      const ip = ips.sort()[0]; // Always use the first ip

      if (provider.ip === ip) {
        console.log(`Ip for ${provider.hostUri} is the same`);
        continue;
      }

      const location = await getIpLocation(ip);

      console.log(`${provider.hostUri} ip lookup: ${location.region}, ${location.country}`);

      if (location) {
        await provider.update({
          ip: ip,
          ipRegion: location.region,
          ipRegionCode: location.regionCode,
          ipCountry: location.country,
          ipCountryCode: location.countryCode,
          ipLat: location.lat,
          ipLon: location.lon
        });
      }

      await sleep(IpLookupDelay);
    } catch (e) {
      console.error(e);
    }
  }
}
