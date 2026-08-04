import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import dns from "dns/promises";
import { isIP } from "net";
import { setTimeout as sleep } from "node:timers/promises";

const IpLookupDelay = 2_000;

interface IpApiResponse {
  status: string;
  regionName: string;
  region: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
}

async function getIpLocation(ip: string) {
  const response = await fetch(`http://ip-api.com/json/${ip}`);

  if (!response.ok) {
    throw new Error(`Could not get location for ip ${ip}. Request failed with status code ${response.status}`);
  }

  const data = (await response.json()) as IpApiResponse;

  if (data.status !== "success") {
    throw new Error(`Could not get location for ip ${ip}`);
  }

  return {
    region: data.regionName,
    regionCode: data.region,
    country: data.country,
    countryCode: data.countryCode,
    lat: data.lat,
    lon: data.lon
  };
}

export async function updateProvidersLocation(): Promise<void> {
  const providers = await Provider.findAll({
    where: {
      isOnline: true
    }
  });

  console.log(`${providers.length} providers to lookup`);

  for (const provider of providers) {
    try {
      const parsedUri = new URL(provider.hostUri);
      let ip: string;

      if (isIP(parsedUri.hostname)) {
        ip = parsedUri.hostname;
      } else {
        const ips = await dns.resolve4(parsedUri.hostname);

        if (ips.length === 0) {
          console.log(`Could not resolve ip for ${provider.hostUri}`);
          continue;
        }

        ip = ips.sort()[0]; // Always use the first ip
      }

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
