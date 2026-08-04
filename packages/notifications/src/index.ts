import { SupportedLocaleSchema } from "@jovia/localization";
import { z } from "zod";

export const NotificationCommandSchema = z.object({
  channel: z.enum(["in_app", "push", "email", "browser", "desktop", "mobile"]),
  priority: z.enum(["critical", "high", "normal", "low"]),
  templateId: z.string().min(1),
  locale: SupportedLocaleSchema,
  recipientRef: z.string().min(1),
  correlationId: z.string().min(1),
  variables: z.record(z.string(), z.unknown()).default({}),
});

export type NotificationCommand = z.infer<typeof NotificationCommandSchema>;

export interface NotificationDelivery {
  deliver(command: NotificationCommand, signal?: AbortSignal): Promise<{ deliveryId: string }>;
}
