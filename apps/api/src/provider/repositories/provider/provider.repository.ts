import { Attribute, SignedBy } from "@akashnetwork/akashjs/build/sdl/types";
import { Provider, ProviderAttributeSignature } from "@akashnetwork/database/dbSchemas/akash";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

import { AUDITOR, TRIAL_ATTRIBUTE } from "@src/deployment/config/provider.config";
import { globToRegExp, includesGlobPattern } from "@src/provider/utils/glob-to-regexp";

@singleton()
export class ProviderRepository {
  async getTrialProviders(): Promise<string[]> {
    const trialProviders = await ProviderAttributeSignature.findAll({
      attributes: ["provider"],
      where: {
        auditor: AUDITOR,
        key: TRIAL_ATTRIBUTE,
        value: "true"
      },
      raw: true
    });

    return trialProviders.map(provider => provider.provider);
  }

  async getProvider(address: string): Promise<Provider | null> {
    return await Provider.findByPk(address);
  }

  async getProvidersHostUriByAttributes(attributes: Attribute[], signatures?: Partial<SignedBy>): Promise<string[]> {
    if (!attributes.length) {
      const providers = await Provider.findAll({
        attributes: ["hostUri"],
        where: {
          isOnline: true,
          deletedHeight: null
        },
        raw: true
      });

      return providers.map(provider => provider.hostUri);
    }

    const attrAssociation = signatures ? Provider.associations.providerAttributeSignatures : Provider.associations.providerAttributes;
    const havingLiterals: string[] = [];
    const havingParams: Record<string, unknown> = {};
    const attrsKeyFilter: unknown[] = [];
    const attrPlainKeys: string[] = [];
    const signaturesConditions: string[] = [];

    if (signatures?.anyOf?.length) {
      signaturesConditions.push(`"${attrAssociation.as}"."auditor" IN (:anyOfSignatures)`);
      havingParams.anyOfSignatures = signatures.anyOf;
    }
    if (signatures?.allOf?.length) {
      signatures.allOf.forEach((signature, index) => {
        const signatureParam = `signature_${index}`;
        signaturesConditions.push(`"${attrAssociation.as}"."auditor" = :${signatureParam}`);
        havingParams[signatureParam] = signature;
      });
    }

    attributes.forEach((item, index) => {
      const keyParam = `having_key_${index}`;
      const valueParam = `having_value_${index}`;
      let keyFilter = "";

      if (includesGlobPattern(item.key)) {
        const regexp = globToRegExp(item.key);
        attrsKeyFilter.push({ [Op.regexp]: regexp });

        keyFilter = `"${attrAssociation.as}"."key" ~ :${keyParam}`;
        havingParams[keyParam] = regexp;
      } else {
        attrPlainKeys.push(item.key);
        keyFilter = `"${attrAssociation.as}"."key" = :${keyParam}`;
        havingParams[keyParam] = item.key;
      }

      const attrCondition = `"${attrAssociation.as}"."value" = :${valueParam} AND ${keyFilter}`;

      if (signaturesConditions.length) {
        signaturesConditions.forEach(signatureCondition => {
          havingLiterals.push(`COUNT(*) FILTER (WHERE ${attrCondition} AND ${signatureCondition}) > 0`);
        });
      } else {
        havingLiterals.push(`COUNT(*) FILTER (WHERE ${attrCondition}) > 0`);
      }

      havingParams[valueParam] = item.value;
    });
    if (attrPlainKeys.length) attrsKeyFilter.push({ [Op.in]: attrPlainKeys });
    const attrsWhere: Record<string, Record<symbol, unknown[]>> = {
      key: { [Op.or]: attrsKeyFilter }
    };

    if (signatures?.anyOf?.length || signatures?.allOf?.length) {
      attrsWhere.auditor = {
        [Op.in]: [...(signatures?.anyOf ?? []), ...(signatures?.allOf ?? [])]
      };
    }

    const rows = await Provider.findAll({
      raw: true,
      attributes: ["hostUri"],
      include: [
        {
          model: attrAssociation.target,
          attributes: [],
          where: attrsWhere
        }
      ],
      where: {
        isOnline: true,
        deletedHeight: null
      },
      group: ["provider", "hostUri"],
      having: Provider.sequelize!.literal(havingLiterals.join(" AND ")),
      replacements: {
        ...havingParams
      }
    });
    return rows.map(row => row.hostUri);
  }
}
