import { env } from "@src/utils/env";
import { verifyRsaJwt } from "../verify-rsa-jwt-cloudflare-worker-main";

export const requiredUserMiddleware = verifyRsaJwt({
  jwksUri: env.Auth0JWKSUri,
  // kvStore: {
  //   get: async (key: string, format: "json") => {
  //     console.log("Get " + key);
  //     return null as unknown;
  //   },
  //   put: async (key: string, value: string, options: any) => {
  //     console.log("Get", key, value, options);
  //   }
  // }, // Anything that keeps a value, KVNamespace would work too.
  payloadValidator: (payload, ctx) => {
    /* Validate the payload, throw an error if invalid */
    console.log("payloadValidator", payload);
  },
  verbose: true
});

// export const optionalUserMiddleware = verifyRsaJwt({
//   jwksUri: env.Auth0JWKSUri,
//   payloadValidator: (payload, ctx) => {
//     /* Validate the payload, throw an error if invalid */
//     console.log("payloadValidator", payload, ctx);
//   }
// });
