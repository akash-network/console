import { singleton } from "tsyringe";

import type { TeamSecretsResealOptions } from "@src/secret/services/team-secrets-reseal/team-secrets-reseal.service";
import { TeamSecretsResealService } from "@src/secret/services/team-secrets-reseal/team-secrets-reseal.service";

@singleton()
export class TeamSecretsResealController {
  constructor(private readonly teamSecretsResealService: TeamSecretsResealService) {}

  async resealTeamDeployments(options: TeamSecretsResealOptions) {
    return await this.teamSecretsResealService.resealTeamDeployments(options);
  }
}
