import { atom } from "jotai";

const previousRoute = atom<string>(null as string);

export default {
  previousRoute
};
