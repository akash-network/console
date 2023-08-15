import { NotificationTemplate } from ".";
import { PropertyTypes } from "../propertyTypes";

export const akashAlertTemplates: NotificationTemplate[] = [
  {
    code: "new-provider",
    name: "New Provider",
    args: [
      { code: "owner", label: "Owner", type: PropertyTypes.Address },
      { code: "hostUri", label: "Host URI", type: PropertyTypes.String },
      { code: "email", label: "Email", type: PropertyTypes.String },
      { code: "website", label: "Website", type: PropertyTypes.String }
    ],
    triggers: [
      {
        type: "/akash.provider.v1beta2.MsgCreateProvider",
        conditions: [
          { key: "owner", arg: "owner" },
          { key: "hostUri", arg: "hostUri" },
          { key: "info.email", arg: "email" },
          { key: "info.website", arg: "website" }
        ]
      }
    ]
  },
  {
    code: "new-deployment",
    name: "New Deployment",
    showNoConditionWarning: true,
    args: [
      { code: "owner", label: "Owner", type: PropertyTypes.Address },
      { code: "depositor", label: "Depositor", type: PropertyTypes.Address }
    ],
    triggers: [
      {
        type: "/akash.deployment.v1beta2.MsgCreateDeployment",
        conditions: [
          { key: "id.owner", arg: "owner" },
          { key: "depositor", arg: "depositor" }
        ]
      }
    ]
  },
  {
    code: "new-lease",
    name: "New Lease",
    showNoConditionWarning: true,
    args: [
      { code: "owner", label: "Owner", type: PropertyTypes.Address },
      { code: "dseq", label: "DSEQ", type: PropertyTypes.DSEQ },
      { code: "provider", label: "Provider", type: PropertyTypes.Address }
    ],
    triggers: [
      {
        type: "/akash.market.v1beta2.MsgCreateLease",
        conditions: [
          { key: "bidId.owner", arg: "owner" },
          { key: "bidId.dseq", arg: "dseq" },
          { key: "bidId.provider", arg: "provider" }
        ]
      }
    ]
  },
  {
    code: "provider-attribute-signed",
    name: "Provider Attribute Signed",
    args: [
      { code: "owner", label: "Provider", type: PropertyTypes.Address },
      { code: "auditor", label: "Auditor", type: PropertyTypes.Address }
    ],
    triggers: [
      {
        type: "/akash.audit.v1beta2.MsgSignProviderAttributes",
        conditions: [
          { key: "owner", arg: "owner" },
          { key: "auditor", arg: "auditor" }
        ]
      }
    ]
  },
  {
    code: "deployment-balance-monitor",
    name: "Deployment Balance Monitor",
    description: "The deployment balance refresh interval is usually 1 hour, but may vary from one provider to another.",
    tracker: "DeploymentBalanceMonitor",
    args: [
      { code: "owner", label: "Owner", type: PropertyTypes.Address, operators: ["="] },
      { code: "dseq", label: "DSEQ", type: PropertyTypes.DSEQ },
      { code: "threshold", label: "Threshold", type: PropertyTypes.Coin }
    ]
  }
];
