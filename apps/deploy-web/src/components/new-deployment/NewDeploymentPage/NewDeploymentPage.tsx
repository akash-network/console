"use client";
import type { FC, ReactNode } from "react";
import { useId } from "react";
import { Skeleton } from "@akashnetwork/ui/components";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Layout from "@src/components/layout/Layout";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { TemplateCard } from "@src/components/templates/TemplateCard/TemplateCard";
import { isPopularTemplate, selectPopularTemplates } from "@src/components/templates/templateGalleryModel";
import { useServices } from "@src/context/ServicesProvider";
import { useTemplates } from "@src/queries/useTemplateQuery";
import { helloWorldTemplate } from "@src/utils/templates";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { AgentModePanel } from "../AgentModePanel/AgentModePanel";
import { ImportSdlButton } from "../ImportSdlButton/ImportSdlButton";
import { LegacyBuilderRedirect } from "../LegacyBuilderRedirect/LegacyBuilderRedirect";
import { StartFromScratchCard } from "../StartFromScratchCard/StartFromScratchCard";

const POPULAR_TEMPLATE_COUNT = 6;

const OVERLINE_CLASSES = "font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground";

const SECTION_LINK_CLASSES =
  "inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground";

export const DEPENDENCIES = {
  useRouter,
  useTemplates,
  Layout,
  CustomNextSeo,
  LegacyBuilderRedirect,
  AgentModePanel,
  ImportSdlButton,
  StartFromScratchCard,
  TemplateCard,
  Skeleton
};

type Props = { dependencies?: typeof DEPENDENCIES };

/** The `/new-deployment` picker. Every option routes on to Configure, which is the one place a deployment is created. */
export const NewDeploymentPage: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = useServices();
  const router = d.useRouter();
  const { isLoading: isLoadingTemplates, templates } = d.useTemplates();
  const popularTemplates = selectPopularTemplates(templates, POPULAR_TEMPLATE_COUNT);

  const startFromOwnContainer = () => {
    analyticsService.track("run_custom_container_btn_clk", "Amplitude");
    router.push(UrlService.configureDeployment({}));
  };

  const startFromLinuxMachine = () => {
    analyticsService.track("launch_container_vm_btn_clk", "Amplitude");
    router.push(UrlService.configureDeployment({ vm: true }));
  };

  return (
    <d.LegacyBuilderRedirect>
      <d.Layout isLoading={isLoadingTemplates} disableContainer>
        <d.CustomNextSeo title="New Deployment" url={`${domainName}${UrlService.newDeployment()}`} />

        <div className="container px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
          <Link
            href={UrlService.deploymentList()}
            className="mb-2.5 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to deployments
          </Link>

          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-6">
            <div className="min-w-[min(280px,100%)] flex-1">
              <h1 className="text-2xl font-bold leading-9 tracking-[-0.02em] sm:text-[28px]">What do you want to deploy?</h1>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                Start from scratch or pick a template. Everything is editable in the next step.
              </p>
            </div>
            <d.ImportSdlButton />
          </header>

          <d.AgentModePanel />

          <PageSection title="Start from scratch" className="mt-10">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <d.StartFromScratchCard
                title="Bring your own container"
                description="Run any Docker image from any registry. Configure ports, variables, and resources."
                example="ghcr.io/you/app:latest"
                artSrc="/images/new-deployment/byo-container.webp"
                onSelect={startFromOwnContainer}
              />
              <d.StartFromScratchCard
                title="Spin up a Linux machine"
                description="A stock Ubuntu image with SSH access, a clean box you can build on."
                example="ubuntu 24.04 · ssh"
                artSrc="/images/new-deployment/linux-machine.webp"
                onSelect={startFromLinuxMachine}
              />
            </div>
          </PageSection>

          <PageSection
            title="Popular templates"
            className="mt-14"
            actions={
              <>
                <Link href={UrlService.configureDeployment({ templateId: helloWorldTemplate.code })} className={SECTION_LINK_CLASSES}>
                  Try hello world
                </Link>
                <Link href={UrlService.templates()} className={SECTION_LINK_CLASSES}>
                  View all templates
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1100px]:grid-cols-3">
              {popularTemplates.map(template => (
                <d.TemplateCard key={template.id} template={template} isPopular={isPopularTemplate(template)} />
              ))}
              {isLoadingTemplates &&
                popularTemplates.length === 0 &&
                Array.from({ length: POPULAR_TEMPLATE_COUNT }, (_, index) => <d.Skeleton key={index} className="h-[118px] rounded-[14px]" />)}
            </div>
          </PageSection>
        </div>
      </d.Layout>
    </d.LegacyBuilderRedirect>
  );
};

const PageSection: FC<{ title: string; actions?: ReactNode; className?: string; children: ReactNode }> = ({ title, actions, className, children }) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3">
        <h2 id={headingId} className={OVERLINE_CLASSES}>
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{actions}</div>
      </div>
      {children}
    </section>
  );
};
