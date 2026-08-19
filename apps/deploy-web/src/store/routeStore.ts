import { atom } from "jotai";

/** Whether the user has navigated within the app during this SPA session (reset on a full page load). */
const hasNavigatedInApp = atom(false);

export default {
  hasNavigatedInApp
};
