import type { NotificationCommand } from "@jovia/notifications";

export interface NotificationDeliveryResult {
  deliveryId: string;
  acceptedAt: string;
}

export interface NotificationDeliveryPort {
  deliver(command: NotificationCommand, signal?: AbortSignal): Promise<NotificationDeliveryResult>;
}
