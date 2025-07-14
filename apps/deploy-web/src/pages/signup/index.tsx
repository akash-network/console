import { OnboardingPage } from "@src/components/onboarding/OnboardingPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default OnboardingPage;

export const getServerSideProps = defineServerSideProps({
  route: "/signup"
});
