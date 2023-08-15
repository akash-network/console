import { IMessageSchema } from ".";
import { PropertyTypes } from "../propertyTypes";

const schemaDeploymentID = {
  owner: PropertyTypes.Address,
  dseq: PropertyTypes.DSEQ
};

const schemaBidID = {
  owner: PropertyTypes.Address,
  provider: PropertyTypes.Address,
  dseq: PropertyTypes.DSEQ,
  gseq: PropertyTypes.Integer,
  oseq: PropertyTypes.Integer
};

export const schemaAttributeList = [
  {
    key: PropertyTypes.String,
    value: PropertyTypes.String
  }
];

export const akashSchemas: IMessageSchema[] = [
  {
    type: "/akash.audit.v1beta2.MsgSignProviderAttributes",
    properties: {
      owner: PropertyTypes.Address,
      auditor: PropertyTypes.Address,
      attributes: schemaAttributeList
    }
  },
  {
    type: "/akash.provider.v1beta2.MsgCreateProvider",
    properties: {
      owner: PropertyTypes.Address,
      hostUri: PropertyTypes.String,
      attributes: schemaAttributeList,
      info: {
        email: PropertyTypes.String,
        website: PropertyTypes.String
      }
    }
  },
  {
    type: "/akash.deployment.v1beta2.MsgCreateDeployment",
    showNoConditionWarning: true,
    properties: {
      id: schemaDeploymentID,
      groups: [
        {
          name: PropertyTypes.String,
          requirements: {
            signedBy: {
              allOf: PropertyTypes.AddressList,
              anyOf: PropertyTypes.AddressList
            },
            attributes: schemaAttributeList
          },
          resources: [
            {
              resources: {
                cpu: { units: { val: PropertyTypes.CPU }, attributes: schemaAttributeList },
                memory: { quantity: { val: PropertyTypes.Memory }, attributes: schemaAttributeList },
                storage: [{ name: PropertyTypes.String, quantity: { val: PropertyTypes.Storage }, attributes: schemaAttributeList }],
                endpoints: [{ kind: PropertyTypes.EndpointKind, sequenceNumber: PropertyTypes.Integer }]
              },
              count: PropertyTypes.Integer,
              price: PropertyTypes.Coin // TODO: Test DecCoin
            }
          ]
        }
      ],
      //version:
      deposit: PropertyTypes.Coin,
      depositor: PropertyTypes.Address
    }
  },
  {
    type: "/akash.market.v1beta2.MsgCreateLease",
    showNoConditionWarning: true,
    properties: {
      bidId: schemaBidID
    }
  },
  {
    type: "/akash.market.v1beta2.MsgWithdrawLease",
    showNoConditionWarning: true,
    properties: {
      bidId: schemaBidID
    }
  }
];
