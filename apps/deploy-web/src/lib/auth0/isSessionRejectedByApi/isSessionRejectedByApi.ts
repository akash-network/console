import { isAxiosError } from "axios";

/** console-api answers 401 to an unexpired token whose user it no longer has, such as an account deleted from another device. */
export function isSessionRejectedByApi(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 401;
}
