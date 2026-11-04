import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { resolveHomePath } from "@src/lib/nextjs/resolveHomePath/resolveHomePath";
import { definePublicPage } from "@src/lib/pages/definePublicPage";

const HomePage = () => null;

export default definePublicPage(HomePage);

export const getServerSideProps = defineServerSideProps({
  route: "/",
  public: true,
  handler: async context => ({ redirect: { destination: await resolveHomePath(context), permanent: false } })
});
