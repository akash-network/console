import React from "react";

import Layout from "@src/components/layout/Layout";
import { PlainVMForm } from "@src/components/sdl/PlainVMForm";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { Title } from "@src/components/shared/Title";
import { domainName, UrlService } from "@src/utils/urlUtils";

function PlainLinuxPage() {
  return (
    <Layout>
      <CustomNextSeo
        title="Plain Linux"
        url={`${domainName}${UrlService.plainLinux()}`}
        description="Choose from multiple linux distros. Deploy and SSH into it. Install and run what you want after that."
      />

      <Title>Plain Linux</Title>

      <p className="mb-8 text-muted-foreground">Choose from multiple linux distros. Deploy and SSH into it. Install and run what you want after that.</p>

      <PlainVMForm />
    </Layout>
  );
}

export default PlainLinuxPage;
