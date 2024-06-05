import React from "react";
import { Discord, Github, X as TwitterX, Youtube } from "iconoir-react";

import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { CustomNextSeo } from "../components/shared/CustomNextSeo";

const ContactPage: React.FunctionComponent = () => {
  return (
    <Layout>
      <CustomNextSeo title="Contact" url={`${domainName}${UrlService.contact()}`} />

      <div className="py-12 text-center">
        <Title>Contact us</Title>

        <div className="space-y-1 pt-4">
          <p className="text-lg">Need help or have an issue with something?</p>
          <p className="text-sm">The best way to reach us is through our discord server or twitter.</p>
        </div>

        <ul className="flex items-center justify-center py-8">
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
              href="https://youtube.com/@AkashNetwork?si=cd2P3ZlAa4gNQw0X?sub_confirmation=1"
              target="_blank"
              className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
            >
              <Youtube className="mx-auto block h-6 w-6 text-5xl" />
            </a>
          </li>
          <li>
            <a
              href="https://twitter.com/akashnet_"
              target="_blank"
              className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
            >
              <TwitterX className="mx-auto block h-6 w-6 text-5xl" />
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
