import Image from "next/image";
import Link from "next/link";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";

const FaqEntries = [
  {
    anchor: "cpu-support",
    title: "Which CPUs are officially supported?",
    content: (
      <>
        <p>
          <Link href="https://akash.network/docs/deployments/akash-cli/installation/#cpu-support" target="_blank">
            Only x86_64 processors
          </Link>{" "}
          are officially supported for Akash deployments. This may change in the future and when ARM processors are supported it will be announced and
          documented.
        </p>
        <p>
          If you're on MacOS or linux, you can specify the{" "}
          <Link
            href="https://stackoverflow.com/questions/69054921/docker-on-mac-m1-gives-the-requested-images-platform-linux-amd64-does-not-m/69119815#69119815"
            target="_blank"
          >
            target platform
          </Link>{" "}
          when building your docker image. For example, if you're using a Dockerfile you can use the following command:
        </p>
        <p>
          <code>docker build -t my-image --platform linux/amd64 .</code>
        </p>
      </>
    )
  },
  {
    anchor: "lease-closed",
    title: "My lease is closed, but the deployment isn't.",
    content: (
      <>
        <p>
          If your lease is closed, but your deployment isn't, that means your provider closed it. You will need to close your deployment and create a new one.
          You can try deploying on a different provider to see if that helps.
          <br />
          <br />
          Here's some possible reasons why a provider could close your lease:
        </p>
        <ul className="list-disc py-4 pl-8">
          <li>Your docker image was not able to be downloaded or crashed on launch.</li>
          <li>Your deployment was using more resources than what was specified in your sdl. For example, you used more disk space than allowed.</li>
          <li>Your deployment did not meet the terms of service of the provider. Ultimately, each provider can choose what workload they allow.</li>
          <li>The provider had to close your lease due to some outage or maintenance on their servers.</li>
        </ul>
        <p>
          To know the exact cause you can try contacting your provider in the{" "}
          <Link href="https://discord.com/channels/747885925232672829/1111749310325981315" target="_blank">
            #provider
          </Link>{" "}
          discord channel.
        </p>
      </>
    )
  },
  {
    anchor: "shell-arrows-and-completion",
    title: "Shell: UP arrow and TAB autocompletion does not work",
    content: (
      <p>
        Some docker images use "sh" as the default shell. This shell does not support up arrow and TAB autocompletion. You may try sending the "bash" command to
        switch to a bash shell which support those feature.
      </p>
    )
  },
  {
    anchor: "send-manifest-resources-mismatch",
    title: `Error while sending manifest to provider. Error: manifest cross-validation error: group "X": service "X": CPU/Memory resources mismatch for ID 1`,
    content: (
      <>
        <p>
          This commonly happen if you try to change the hardware specs of your deployment. For example, if you try to increase the amount of memory or cpu. If
          you need to change the hardware spec you will need to close your deployment and create a new one.
        </p>
        <p>
          This can also happen if your deployment has multiple services and was created before the Mainnet 6 upgrade on August 31st, 2023. In this case, you
          will also need to close your deployment and create a new one.
        </p>
      </>
    )
  },
  {
    anchor: "other-issues",
    title: "My issue is not listed",
    content: (
      <>
        <p>Here are some actions you can take to fix most of the errors you may encounter:</p>
        <ul className="list-disc py-4 pl-8">
          <li>
            <strong>Change the selected node in the settings.</strong> Nodes are public services and can have outages and rate limiting.
            <br />
            <Image src={"/images/faq/change-node.png"} alt="Change Node" width={400} height={294} />
          </li>
          <li>
            <strong>Try using another provider.</strong> The provider may be misconfigured or suffering from an outage.
          </li>
          <li>
            <strong>Wait a bit and try again later.</strong> Some problem are temporary and simply waiting a bit and trying again will work.
          </li>
        </ul>
        <p>
          If you still have an issue after taking these steps, please ask your question in the{" "}
          <Link href="https://discord.gg/akash" target="_blank">
            #deployments
          </Link>{" "}
          channel. If you have issue creating or updating a deployment, it can help to include your SDL. Make sure to remove any sensitive information from it
          before sharing (ex: secrets in your env variables).
        </p>
      </>
    )
  }
] as const;

export type FaqAnchorType = (typeof FaqEntries)[number]["anchor"];

export default function FaqPage() {
  return (
    <Layout>
      <NextSeo title={`Frequently Asked Questions`} />
      <Title>Frequently Asked Questions</Title>

      <div className="prose dark:prose-invert prose-code:before:hidden prose-code:after:hidden">
        <ul className="list-disc py-4 pl-8">
          {FaqEntries.map(entry => (
            <li key={entry.anchor}>
              <Link href={"#" + entry.anchor}>{entry.title}</Link>
            </li>
          ))}
        </ul>

        <div className="pb-8">
          {FaqEntries.map(entry => (
            <div key={entry.anchor}>
              <Title subTitle id={entry.anchor} className="my-4">
                {entry.title}
              </Title>
              {entry.content}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
