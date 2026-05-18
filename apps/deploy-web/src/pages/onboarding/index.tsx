import { OnboardingPickerPage } from "@src/components/onboarding-picker/OnboardingPickerPage";
import { Guard } from "@src/hoc/guard/guard.hoc";
import { useIsRegisteredUser } from "@src/hooks/useUser";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated } from "@src/lib/nextjs/pageGuards/pageGuards";
import { helloWorldTemplate } from "@src/utils/templates";

export default Guard(OnboardingPickerPage, useIsRegisteredUser);

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
  if: async ctx => {
    if (!(await isAuthenticated(ctx))) return { redirect: { destination: "/", permanent: false } };
    return true;
  }
});
