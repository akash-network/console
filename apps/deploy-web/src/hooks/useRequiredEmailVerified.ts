import { useCustomUser } from "./useCustomUser";

export const useIsEmailVerified = () => {
  const { user } = useCustomUser();
  return !user || !!user?.emailVerified;
};
