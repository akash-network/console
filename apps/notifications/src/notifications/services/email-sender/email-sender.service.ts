import { Injectable } from '@nestjs/common';
import { Novu } from '@novu/node';

@Injectable()
export class EmailSenderService {
  constructor(private readonly novu: Novu) {}

  async send(to: any, payload: any) {
    await this.novu.trigger('generic', {
      to: to,
      payload: payload,
    });
  }
}
