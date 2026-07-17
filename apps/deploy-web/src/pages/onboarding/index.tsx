import { OnboardingPickerPage } from "@src/components/onboarding-picker/OnboardingPickerPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default OnboardingPickerPage;

export const getServerSideProps = defineServerSideProps({
  route: "/onboarding"
});
