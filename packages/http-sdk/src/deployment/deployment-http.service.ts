import z from "zod";

import { HttpService } from "../http/http.service";
import { loadWithPagination } from "../utils/pagination.utils";

const AttributeSchema = z.object({
  key: z.string(),
  value: z.string()
});

const QuantitySchema = z.object({
  val: z.string()
});

const DenominatedValueSchema = z.object({
  denom: z.string(),
  amount: z.string()
});

export const DeploymentInfoSchema = z.object({
  deployment: z.object({
    deployment_id: z.object({
      owner: z.string(),
      dseq: z.string()
    }),
    state: z.string(),
    version: z.string(),
    created_at: z.string()
  }),
  groups: z.array(
    z.object({
      group_id: z.object({
        owner: z.string(),
        dseq: z.string(),
        gseq: z.number()
      }),
      state: z.string(),
      group_spec: z.object({
        name: z.string(),
        requirements: z.object({
          signed_by: z.object({
            all_of: z.array(z.string()),
            any_of: z.array(z.string())
          }),
          attributes: z.array(AttributeSchema)
        }),
        resources: z.array(
          z.object({
            resource: z.object({
              id: z.number(),
              cpu: z.object({
                units: QuantitySchema,
                attributes: z.array(AttributeSchema)
              }),
              memory: z.object({
                quantity: QuantitySchema,
                attributes: z.array(AttributeSchema)
              }),
              storage: z.array(
                z.object({
                  name: z.string(),
                  quantity: QuantitySchema,
                  attributes: z.array(AttributeSchema)
                })
              ),
              gpu: z.object({
                units: QuantitySchema,
                attributes: z.array(AttributeSchema)
              }),
              endpoints: z.array(z.object({ kind: z.string(), sequence_number: z.number() }))
            }),
            count: z.number(),
            price: DenominatedValueSchema
          })
        )
      }),
      created_at: z.string()
    })
  ),
  escrow_account: z.object({
    id: z.object({
      scope: z.string(),
      xid: z.string()
    }),
    owner: z.string(),
    state: z.string(),
    balance: DenominatedValueSchema,
    transferred: z.object({
      denom: z.string(),
      amount: z.string()
    }),
    settled_at: z.string(),
    depositor: z.string(),
    funds: DenominatedValueSchema
  })
});
export type DeploymentInfo = z.infer<typeof DeploymentInfoSchema>;

export type RestAkashDeploymentInfoResponse =
  | {
      code: number;
      message: string;
      details: string[];
    }
  | DeploymentInfo;

type DeploymentListResponse = {
  deployments: DeploymentInfo[];
  pagination: {
    next_key: string | null;
    total: string;
  };
};

type DeploymentListParams = {
  "filters.owner": string;
  "filters.state"?: string;
  "pagination.limit"?: number;
  "pagination.offset"?: number;
  "pagination.key"?: string;
  "pagination.count_total"?: boolean;
  "pagination.reverse"?: boolean;
};

interface PaginationParams {
  key?: string;
  offset?: number;
  limit?: number;
  countTotal?: boolean;
  reverse?: boolean;
}

export class DeploymentHttpService extends HttpService {
  public async findByOwnerAndDseq(owner: string, dseq: string): Promise<RestAkashDeploymentInfoResponse> {
    return this.extractData(
      await this.get<RestAkashDeploymentInfoResponse>("/akash/deployment/v1beta3/deployments/info", {
        params: {
          "id.owner": owner,
          "id.dseq": dseq
        },
        validateStatus: status => (status >= 200 && status < 300) || (status >= 400 && status < 500)
      })
    );
  }

  /**
   * Load deployments for an owner with optional pagination
   * @param owner Owner address
   * @param state Optional state filter
   * @param pagination Optional pagination parameters
   * @returns Paginated response with deployments
   */
  public async loadDeploymentList(owner: string, state?: "active" | "closed", pagination?: PaginationParams): Promise<DeploymentListResponse> {
    const baseUrl = this.axios.getUri({
      url: `/akash/deployment/v1beta3/deployments/list?filters.owner=${owner}${state ? `&filters.state=${state}` : ""}`
    });
    const defaultLimit = 1000;

    if (!pagination) {
      const allDeployments = await loadWithPagination<DeploymentInfo>(baseUrl, "deployments", defaultLimit, this);
      return {
        deployments: allDeployments,
        pagination: {
          next_key: null,
          total: allDeployments.length.toString()
        }
      };
    }

    const params: DeploymentListParams = {
      "filters.owner": owner,
      // As per the documenation, Only one of offset or key should be set.
      // https://github.com/cosmos/cosmos-sdk/blob/main/types/query/pagination.pb.go#L33
      "pagination.limit": pagination.limit || defaultLimit,
      "pagination.offset": pagination.key ? undefined : pagination.offset,
      "pagination.key": pagination.offset ? undefined : pagination.key,
      // count_total is only respected when offset is used. It is ignored when key is set.
      "pagination.count_total": pagination.offset !== undefined ? true : pagination.countTotal,
      "pagination.reverse": pagination.reverse
    };

    if (state) {
      params["filters.state"] = state;
    }

    return this.extractData(
      await this.get<DeploymentListResponse>("/akash/deployment/v1beta3/deployments/list", {
        params
      })
    );
  }
}
