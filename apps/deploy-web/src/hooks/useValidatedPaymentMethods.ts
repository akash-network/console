import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { useUser } from "@src/hooks/useUser";

export const useValidatedPaymentMethods = () => {
  const { user } = useUser();
  const { stripeService } = useServices();

  return useQuery({
    queryKey: ["validated-payment-methods", user?.id],
    queryFn: async () => {
      if (!user?.stripeCustomerId) {
        return [];
      }

      try {
        const validatedMethods = await stripeService.getValidatedPaymentMethods(user.stripeCustomerId);
        return validatedMethods;
      } catch (error) {
        console.error("Failed to fetch validated payment methods:", error);
        return [];
      }
    },
    enabled: !!user?.stripeCustomerId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};
