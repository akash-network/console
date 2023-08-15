import { useUser } from "@auth0/nextjs-auth0";
import { CustomUserProfile } from "@src/types/user";
import { plans } from "@src/utils/plans";

type UseCustomUser = {
  user: CustomUserProfile;
  isLoading: boolean;
  error: Error;
  checkSession: () => Promise<void>;
};

export const useCustomUser = (): UseCustomUser => {
  const { user, isLoading, error, checkSession } = useUser();

  const completeUser = user ? { ...user, plan: plans.find(x => x.code === user.planCode) } : user;

  return {
    user: completeUser as CustomUserProfile,
    isLoading,
    error,
    checkSession
  };
};
