import { Injectable } from '@nestjs/common';

import { NotificationCommandDto } from '../../dto/NotificationCommand.dto';
import { EmailSenderService } from '../email-sender/email-sender.service';

@Injectable()
export class NotificationRouterService {
  constructor(private readonly emailSenderService: EmailSenderService) {}

  async send(notificationCommand: NotificationCommandDto) {
    if (notificationCommand.channel.type === 'email') {
      await this.emailSenderService.send(
        notificationCommand.channel,
        notificationCommand.payload,
      );
    } else {
      throw new Error('Unsupported channel type');
    }
  }
}
