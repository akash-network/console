import { ReactNode } from "react";
import { Title } from "@src/components/shared/Title";
import { CustomNextSeo } from "../components/shared/CustomNextSeo";
import Layout from "@src/components/layout/Layout";
import { UrlService } from "@src/utils/urlUtils";
import { Youtube, Twitter, Github, Discord } from "iconoir-react";

type Props = {
  children?: ReactNode;
};

const ContactPage: React.FunctionComponent<Props> = ({}) => {
  return (
    <Layout>
      <CustomNextSeo title="Contact" url={`https://deploy.cloudmos.io${UrlService.contact()}`} />

      <div className="py-12 text-center">
        <Title>Contact us</Title>

        <div className="space-y-2 pt-4">
          <p>Need help or have an issue with something?</p>
          <p className="text-sm">The best way to reach us is through our discord server or twitter.</p>
        </div>

        <ul className="flex items-center justify-center sm:justify-normal">
          <li>
            <a
              href="https://discord.gg/akash"
              target="_blank"
              className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
            >
              <Discord className="mx-auto block h-6 w-6 text-5xl" />
            </a>
          </li>
          <li>
            <a
              href="https://www.youtube.com/channel/UC1rgl1y8mtcQoa9R_RWO0UA?sub_confirmation=1"
              target="_blank"
              className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
            >
              <Youtube className="mx-auto block h-6 w-6 text-5xl" />
            </a>
          </li>
          <li>
            <a
              href="https://twitter.com/cloudmosio"
              target="_blank"
              className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
            >
              <Twitter className="mx-auto block h-6 w-6 text-5xl" />
            </a>
          </li>
          <li>
            <a
              href="https://github.com/akash-network/cloudmos"
              target="_blank"
              className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
            >
              <Github className="mx-auto block h-6 w-6 text-5xl" />
            </a>
          </li>
        </ul>
      </div>
    </Layout>
  );
};

export default ContactPage;
