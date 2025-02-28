import { MockComponents } from "tests/unit/mocks";

import { COMPONENTS, DeploymentName, Props } from "./DeploymentName";

import { render, screen } from "@testing-library/react";

describe(DeploymentName.name, () => {
  it("renders only deployment dseq if no name", () => {
    const deployment = { dseq: "123" };
    const { container } = setup({ deployment });

    expect(container.textContent?.trim()).toBe(deployment.dseq);
  });

  it("should render deployment name and dseq if provided", () => {
    const deployment = { dseq: "123", name: "test" };
    setup({ deployment });

    expect(screen.queryByText(deployment.name)).toBeInTheDocument();
    expect(screen.queryByText(deployment.dseq)).toBeInTheDocument();
  });

  it("renders first deployment service URI if no name specified", () => {
    const deploymentServices = {
      test: { uris: ["test.com", "another.test.com"] }
    };
    setup({ deploymentServices });

    expect(screen.queryByText(deploymentServices.test.uris[0])).toBeInTheDocument();
    expect(screen.queryByText(deploymentServices.test.uris[1])).not.toBeInTheDocument();
  });

  it("renders deployment name even when deployment services are provided", () => {
    const deployment = { dseq: "123", name: "Test Deployment" };
    const deploymentServices = {
      test: { uris: ["test.com", "another.test.com"] }
    };
    setup({ deployment, deploymentServices });

    expect(screen.queryByText(deployment.name)).toBeInTheDocument();
    expect(screen.queryByText(deploymentServices.test.uris[0])).not.toBeInTheDocument();
    expect(screen.queryByText(deploymentServices.test.uris[1])).not.toBeInTheDocument();
  });

  it("renders first deployment service URI that is not a subdomain of provider host and name is not specified", () => {
    const deploymentServices = {
      test: { uris: ["test.com", "api.akash.network"] }
    };
    setup({
      deploymentServices,
      providerHostUri: "https://provider.test.com:8443"
    });

    expect(screen.queryByText(deploymentServices.test.uris[0])).not.toBeInTheDocument();
    expect(screen.queryByText(deploymentServices.test.uris[1])).toBeInTheDocument();
  });

  it("renders first deployment service URI if all URIs are subdomains of provider host", () => {
    const deploymentServices = {
      test: { uris: ["test.com", "adasdq3dfslkm1o232.provider.test.com"] }
    };
    setup({
      deploymentServices,
      providerHostUri: "https://provider.test.com:8443"
    });

    expect(screen.queryByText(deploymentServices.test.uris[0])).toBeInTheDocument();
    expect(screen.queryByText(deploymentServices.test.uris[1])).not.toBeInTheDocument();
  });

  it("renders deployment details in tooltip", () => {
    const deployment = { dseq: "dseq:123", name: "Test Deployment" };
    const deploymentServices = {
      test: { uris: ["test.com", "adasdq3dfslkm1o232.provider.test.com"] },
      api: { uris: ["api.akash.network"] }
    };
    setup({
      deployment,
      deploymentServices,
      renderTooltip: true
    });

    expect(screen.queryByText(deployment.name)).toBeInTheDocument();
    expect(screen.queryByText(deployment.dseq)).toBeInTheDocument();
    expect(screen.queryByText(deploymentServices.test.uris[0])).toBeInTheDocument();
    expect(screen.queryByText(deploymentServices.test.uris[1])).toBeInTheDocument();
    expect(screen.queryByText(deploymentServices.api.uris[0])).toBeInTheDocument();
  });

  it("does not render name in tooltip if it is not provided", () => {
    const deployment = { dseq: "dseq:123" };
    const deploymentServices = {
      test: { uris: ["test.com", "adasdq3dfslkm1o232.provider.test.com"] },
      api: { uris: ["api.akash.network"] }
    };
    setup({
      deployment,
      deploymentServices,
      renderTooltip: true
    });

    expect(screen.queryByText("Name:")).not.toBeInTheDocument();
    expect(screen.queryByText(deployment.dseq)).toBeInTheDocument();
    expect(screen.queryByText(deploymentServices.test.uris[0])).toBeInTheDocument();
    expect(screen.queryByText(deploymentServices.test.uris[1])).toBeInTheDocument();
    expect(screen.queryByText(deploymentServices.api.uris[0])).toBeInTheDocument();
  });

  function setup(input?: TestInput) {
    return render(
      <DeploymentName
        deployment={input?.deployment || { dseq: "123" }}
        providerHostUri={input?.providerHostUri}
        deploymentServices={input?.deploymentServices}
        components={MockComponents(COMPONENTS, {
          CustomTooltip: input?.renderTooltip ? (props: Record<string, React.ReactNode | string>) => <div>{props.title}</div> : undefined,
          LabelValue: (props: Record<string, React.ReactNode | string>) => <div>{props.label}</div>
        })}
      />
    );
  }

  interface TestInput extends Partial<Props> {
    renderTooltip?: boolean;
  }
});
