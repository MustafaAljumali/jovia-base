import { z } from "zod";

export const ProblemDetailsSchema = z.object({
  type: z.string().default("about:blank"),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().min(1),
  correlationId: z.string().min(1).optional(),
});

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly title: string;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(options: {
    code: string;
    status: number;
    title: string;
    message?: string;
    details?: Readonly<Record<string, unknown>>;
    cause?: unknown;
  }) {
    super(options.message ?? options.title, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status;
    this.title = options.title;
    this.details = options.details;
  }
}
