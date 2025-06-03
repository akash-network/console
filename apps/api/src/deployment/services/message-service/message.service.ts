import { singleton } from "tsyringe";

import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { MessageRepository } from "@src/deployment/repositories/message/message.repository";

@singleton()
export class MessageService {
  constructor(
    private readonly deploymentRepository: DeploymentRepository,
    private readonly messageRepository: MessageRepository
  ) {}

  async getDeploymentRelatedMessages(owner: string, dseq: string) {
    const deployment = await this.deploymentRepository.findByOwnerAndDseq(owner, dseq);
    if (!deployment) {
      return null;
    }

    return await this.messageRepository.getDeploymentRelatedMessages(deployment.id);
  }
}
