import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import axios from "axios";

export const getProviderAttributesSchema = async () => {
  // Fetching provider attributes schema
  const response = await cacheResponse(
    30,
    cacheKeys.getProviderAttributesSchema,
    async () => await axios.get("https://raw.githubusercontent.com/akash-network/cloudmos/main/config/provider-attributes.json")
  );

  return response.data;
};
