import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.js';

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('Email delivery is not configured (SMTP_URL is empty)');
  }
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transport: Transporter | undefined;
  private readonly from: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.transport = config.smtpUrl ? nodemailer.createTransport(config.smtpUrl) : undefined;
    this.from = config.mailFrom;
  }

  get configured(): boolean {
    return this.transport !== undefined;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transport) throw new EmailNotConfiguredError();
    await this.transport.sendMail({ from: this.from, ...message });
    this.logger.log(`Email "${message.subject}" sent`);
  }
}
