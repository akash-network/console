import { singleton } from "tsyringe";

import { ProductUpdateUnsubscriptionService } from "@src/user/services/product-update-unsubscription/product-update-unsubscription.service";

@singleton()
export class ProductUpdateUnsubscriptionController {
  constructor(private readonly productUpdateUnsubscriptionService: ProductUpdateUnsubscriptionService) {}

  async create(token: string): Promise<void> {
    await this.productUpdateUnsubscriptionService.unsubscribe(token);
  }
}
