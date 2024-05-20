import { atom } from "jotai";

const previousRoute = atom<string | null>(null);

export default {
  previousRoute
};
