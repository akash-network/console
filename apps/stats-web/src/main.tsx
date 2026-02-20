import "@akashnetwork/ui/styles";
import "./styles/index.css";

import * as Sentry from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { App } from "./App";
import { browserEnvConfig } from "./config/browser-env.config";
import { AddressDeploymentsPage } from "./pages/addresses/[address]/deployments/page";
import { DeploymentDetailPage } from "./pages/addresses/[address]/deployments/[dseq]/page";
import { AddressDetailPage } from "./pages/addresses/[address]/page";
import { AddressTransactionsPage } from "./pages/addresses/[address]/transactions/page";
import { BlocksPage } from "./pages/blocks/page";
import { BlockDetailPage } from "./pages/blocks/[height]/page";
import { GraphPage } from "./pages/graph/[snapshot]/page";
import { HomePage } from "./pages/home/page";
import { MaintenancePage } from "./pages/maintenance/page";
import { NotFoundPage } from "./pages/not-found";
import { ProviderGraphPage } from "./pages/provider-graph/[snapshot]/page";
import { TransactionsPage } from "./pages/transactions/page";
import { TransactionDetailPage } from "./pages/transactions/[hash]/page";
import { ValidatorsPage } from "./pages/validators/page";
import { ValidatorDetailPage } from "./pages/validators/[address]/page";

// Initialize Sentry
if (browserEnvConfig.VITE_SENTRY_DSN && browserEnvConfig.VITE_SENTRY_ENABLED) {
  Sentry.init({
    dsn: browserEnvConfig.VITE_SENTRY_DSN,
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false
      })
    ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0
  });
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: "blocks",
        element: <BlocksPage />
      },
      {
        path: "blocks/:height",
        element: <BlockDetailPage />
      },
      {
        path: "transactions",
        element: <TransactionsPage />
      },
      {
        path: "transactions/:hash",
        element: <TransactionDetailPage />
      },
      {
        path: "validators",
        element: <ValidatorsPage />
      },
      {
        path: "validators/:address",
        element: <ValidatorDetailPage />
      },
      {
        path: "addresses/:address",
        element: <AddressDetailPage />
      },
      {
        path: "addresses/:address/deployments",
        element: <AddressDeploymentsPage />
      },
      {
        path: "addresses/:address/deployments/:dseq",
        element: <DeploymentDetailPage />
      },
      {
        path: "addresses/:address/transactions",
        element: <AddressTransactionsPage />
      },
      {
        path: "graph/:snapshot",
        element: <GraphPage />
      },
      {
        path: "provider-graph/:snapshot",
        element: <ProviderGraphPage />
      },
      {
        path: "maintenance",
        element: <MaintenancePage />
      },
      {
        path: "*",
        element: <NotFoundPage />
      }
    ]
  }
]);

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

const root = createRoot(container);
root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
