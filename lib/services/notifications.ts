import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { NotificationPayload } from "@/lib/validation/json";

export interface NotificationMessage {
  userId: string;
  type: NotificationType;
  payload: NotificationPayload;
}

/** A delivery channel. Add SmsChannel / WhatsAppChannel later by implementing this. */
export interface NotificationChannel {
  readonly name: string;
  deliver(messages: NotificationMessage[], tx?: Prisma.TransactionClient): Promise<void>;
}

export class InAppChannel implements NotificationChannel {
  readonly name = "in-app";
  async deliver(messages: NotificationMessage[], tx?: Prisma.TransactionClient): Promise<void> {
    if (messages.length === 0) return;
    await (tx ?? prisma).notification.createMany({
      data: messages.map((m) => ({ userId: m.userId, type: m.type, payload: m.payload })),
    });
  }
}

export class NotificationService {
  constructor(private readonly channels: NotificationChannel[]) {}

  async notify(
    userIds: string | string[],
    type: NotificationType,
    payload: NotificationPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
    const messages = ids.map((userId) => ({ userId, type, payload }));
    for (const ch of this.channels) await ch.deliver(messages, tx);
  }
}

export const notifications = new NotificationService([new InAppChannel()]);
