import { OnboardingPickerPage } from "@src/components/onboarding-picker/OnboardingPickerPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default OnboardingPickerPage;

export const getServerSideProps = defineServerSideProps({
  route: "/onboarding",
  if: async ctx => (await isFeatureEnabled("console_onboarding_redesign", ctx)) || { redirect: { destination: "/", permanent: false } }
});
