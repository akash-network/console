import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@akashnetwork/ui/components";
import Link from "next/link";
import { useRouter } from "next/router";

import { NoKeplrSection } from "@src/components/get-started/NoKeplrSection";
import { NoWalletSection } from "@src/components/get-started/NoWalletSection";
import { WithKeplrSection } from "@src/components/get-started/WithKeplrSection";
import { Layout } from "@src/components/layout/Layout";
import { UrlService } from "@src/utils/urlUtils";

enum GetWalletSection {
  NoWallet = "no-wallet",
  NoKeplr = "no-keplr",
  HasKeplr = "has-keplr",
  CreateWallet = "create-wallet"
}

const GetStartedWallet: React.FunctionComponent = () => {
  const router = useRouter();
  const currentSection = Object.values(GetWalletSection).includes(router.query.section as GetWalletSection) ? router.query.section : null;

  const sections = [
    {
      title: "I don't have any cryptocurrencies",
      description: "No worries, we'll guide you through the process of getting your hands on some crypto to be able to deploy.",
      id: GetWalletSection.NoWallet
    },
    {
      title: "I have cryptocurrencies, but not on Keplr wallet",
      description: "Great! We'll guide you through the process of installing the Keplr wallet browser extension and swapping your way to the cosmos ecosystem.",
      id: GetWalletSection.NoKeplr
    },
    {
      title: "I have a Keplr wallet",
      description: "If you're already familiar with the cosmos ecosystem and already have a Keplr wallet, it will be super easy to acquire some AKT!",
      id: GetWalletSection.HasKeplr
    }
  ];

  return (
    <Layout>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={UrlService.getStarted()}>Get Started</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Setup Wallet</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle>Installing Keplr and getting AKT</CardTitle>
        </CardHeader>
        <CardContent className="mt-4 space-y-4">
          {!currentSection &&
            sections.map((section, index) => (
              <Link className="hover:bg-muted block px-4 py-2 hover:no-underline" key={index} href={UrlService.getStartedWallet(section.id)}>
                <p className="text-secondary-foreground font-bold">{section.title}</p>
                <p className="text-muted-foreground text-sm">{section.description}</p>
              </Link>
            ))}

          {currentSection === GetWalletSection.NoWallet && <NoWalletSection />}
          {currentSection === GetWalletSection.NoKeplr && <NoKeplrSection />}
          {currentSection === GetWalletSection.HasKeplr && <WithKeplrSection />}
        </CardContent>
      </Card>
    </Layout>
  );
};

export default GetStartedWallet;
