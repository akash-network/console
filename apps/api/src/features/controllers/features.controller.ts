import { singleton } from "tsyringe";

import { FeaturesService } from "../services/features/features.services";

@singleton()
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  getFeatures() {
    return this.featuresService.getEnabledFeatures();
  }
}
