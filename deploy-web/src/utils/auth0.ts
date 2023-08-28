import { UserProfile } from "@auth0/nextjs-auth0/client";
import { auth0TokenNamespace } from "./constants";

export function getUserField(user: UserProfile, field: "username" | "user_metadata"): any {
  if (user && user[auth0TokenNamespace + "/" + field]) {
    return user[auth0TokenNamespace + "/" + field];
  }
  return null;
}
