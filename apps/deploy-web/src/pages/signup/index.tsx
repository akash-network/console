import { OnboardingPage } from "@src/components/onboarding/OnboardingPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { definePublicPage } from "@src/lib/pages/definePublicPage";

export default definePublicPage(OnboardingPage);

export const getServerSideProps = defineServerSideProps({
  route: "/signup",
  public: true
});
