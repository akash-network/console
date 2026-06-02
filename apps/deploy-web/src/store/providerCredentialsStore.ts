import { atom } from "jotai";

type InFlightTokenRequest = { address: string; promise: Promise<string> } | null;

const inFlightTokenRequest = atom<InFlightTokenRequest>(null);

const claimInFlightTokenRequest = atom(null, (get, set, payload: { address: string; createPromise: () => Promise<string> }): Promise<string> => {
  const current = get(inFlightTokenRequest);
  if (current && current.address === payload.address) {
    return current.promise;
  }
  const promise = payload.createPromise();
  set(inFlightTokenRequest, { address: payload.address, promise });
  return promise;
});

const releaseInFlightTokenRequest = atom(null, (get, set, promise: Promise<string>) => {
  const current = get(inFlightTokenRequest);
  if (current?.promise === promise) {
    set(inFlightTokenRequest, null);
  }
});

const clearInFlightTokenRequestForOtherAddress = atom(null, (get, set, address: string) => {
  const current = get(inFlightTokenRequest);
  if (current && current.address !== address) {
    set(inFlightTokenRequest, null);
  }
});

export default {
  inFlightTokenRequest,
  claimInFlightTokenRequest,
  releaseInFlightTokenRequest,
  clearInFlightTokenRequestForOtherAddress
};
