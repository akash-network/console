import { OnboardingPickerPage } from "@src/components/onboarding-picker/OnboardingPickerPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";
import { helloWorldTemplate } from "@src/utils/templates";

export default OnboardingPickerPage;

export const getServerSideProps = defineServerSideProps({
  route: "/onboarding",
  handler: async ctx => {
    const [imageGenTemplate, llmChatbotTemplate] = await Promise.all([
      ctx.services.template.findById("akash-network-awesome-akash-stable-diffusion-ui"),
      ctx.services.template.findById("akash-network-awesome-akash-Llama-3.1-8B")
    ]);

    return {
      props: {
        templates: {
          helloWorld: helloWorldTemplate.content,
          imageGen: imageGenTemplate.deploy,
          llmChatbot: llmChatbotTemplate.deploy
        }
      }
    };
  },
  if: async ctx => (await isFeatureEnabled("console_onboarding_redesign", ctx)) || { redirect: { destination: "/", permanent: false } }
});
