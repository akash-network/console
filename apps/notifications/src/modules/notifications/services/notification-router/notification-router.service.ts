import { Injectable } from "@nestjs/common";
import { Err, Ok, Result } from "ts-results";

import { RichError } from "@src/lib/rich-error/rich-error";
import { NotificationCommandDto } from "../../dto/NotificationCommand.dto";
import { ContactPointRepository } from "../../repositories/contact-point/contact-point.repository";
import { EmailSenderService } from "../email-sender/email-sender.service";

@Injectable()
export class NotificationRouterService {
  constructor(
    private readonly emailSenderService: EmailSenderService,
    private contactPointRepository: ContactPointRepository
  ) {}

  async send(notificationCommand: NotificationCommandDto): Promise<Result<void, RichError>> {
    const contactPoint = await this.contactPointRepository.findById(notificationCommand.contactPointId);

    if (!contactPoint) {
      return Err(
        new RichError("ContactPoint not found", "NOT_FOUND", {
          contactPointId: notificationCommand.contactPointId
        })
      );
    }

    if (contactPoint.type === "email") {
      await this.emailSenderService.send({
        userId: contactPoint.userId,
        addresses: contactPoint.config.addresses,
        subject: notificationCommand.payload.summary,
        content: notificationCommand.payload.description
      });
    } else {
      return Err(new RichError("ContactPoint type not implemented", "UNSUPPORTED_CONTACT_POINT_TYPE", { contactPoint }));
    }

    return Ok(undefined);
  }
}
