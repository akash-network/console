import { atom } from "jotai";

const inFlightTokenRequest = atom<{ address: string; promise: Promise<string> } | null>(null);

export default {
  inFlightTokenRequest
};
