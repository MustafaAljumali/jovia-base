import { z } from "zod";

import { ProblemDetailsSchema } from "./errors.js";
import { IngestionRunListResponseSchema } from "./ingestion.js";
import {
  CanonicalOpportunitySchema,
  DirectOpportunityCommandSchema,
  OpportunityListQuerySchema,
  OpportunityListResponseSchema,
} from "./opportunities.js";
import { SourceExecutionContextSchema, SourceListResponseSchema } from "./sources.js";

function schema(value: z.ZodType) {
  return z.toJSONSchema(value, { target: "draft-2020-12" });
}

const security = [{ bearerAuth: [] }];
const problemResponse = {
  description: "RFC 9457 problem details",
  content: {
    "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemDetails" } },
  },
};

export function createOpportunityOpenApiDocument(): Readonly<Record<string, unknown>> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Jovia Opportunity Core API",
      version: "1.0.0",
      description: "Governed opportunity publishing, discovery, and operations contracts.",
    },
    paths: {
      "/v1/opportunities": {
        get: {
          operationId: "listOpportunities",
          security,
          parameters: [
            { name: "cursor", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          ],
          responses: {
            "200": {
              description: "Active opportunities",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OpportunityListResponse" },
                },
              },
            },
            "401": problemResponse,
            "403": problemResponse,
            "429": problemResponse,
          },
        },
        post: {
          operationId: "publishOpportunity",
          security,
          parameters: [
            { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DirectOpportunityCommand" },
              },
            },
          },
          responses: {
            "201": {
              description: "Published opportunity",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CanonicalOpportunity" },
                },
              },
            },
            "400": problemResponse,
            "401": problemResponse,
            "403": problemResponse,
            "409": problemResponse,
            "422": problemResponse,
            "429": problemResponse,
          },
        },
      },
      "/v1/opportunities/{id}": {
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        get: {
          operationId: "getOpportunity",
          security,
          responses: {
            "200": { description: "Opportunity" },
            "401": problemResponse,
            "403": problemResponse,
            "404": problemResponse,
            "429": problemResponse,
          },
        },
        put: {
          operationId: "replaceOpportunity",
          security,
          parameters: [
            { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DirectOpportunityCommand" },
              },
            },
          },
          responses: {
            "200": { description: "Replaced opportunity" },
            "401": problemResponse,
            "403": problemResponse,
            "404": problemResponse,
            "409": problemResponse,
            "422": problemResponse,
            "429": problemResponse,
          },
        },
        delete: {
          operationId: "removeOpportunity",
          security,
          parameters: [
            { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } },
            {
              name: "X-Publisher-Organization-Id",
              in: "header",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "X-Publishing-Terms-Version",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "204": { description: "Opportunity tombstoned" },
            "401": problemResponse,
            "403": problemResponse,
            "404": problemResponse,
            "409": problemResponse,
            "422": problemResponse,
            "429": problemResponse,
          },
        },
      },
      "/v1/admin/opportunity-sources": {
        get: {
          operationId: "listOpportunitySources",
          security,
          responses: {
            "200": {
              description: "Exact policy and runtime states",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/SourceListResponse" } },
              },
            },
            "401": problemResponse,
            "403": problemResponse,
            "429": problemResponse,
          },
        },
      },
      "/v1/admin/ingestion-runs": {
        get: {
          operationId: "listIngestionRuns",
          security,
          responses: {
            "200": {
              description: "Ingestion history",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/IngestionRunListResponse" },
                },
              },
            },
            "401": problemResponse,
            "403": problemResponse,
            "429": problemResponse,
          },
        },
      },
      "/v1/openapi.json": {
        get: {
          operationId: "getOpportunityOpenApi",
          security,
          responses: {
            "200": { description: "This OpenAPI document" },
            "401": problemResponse,
            "403": problemResponse,
            "429": problemResponse,
          },
        },
      },
    },
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "opaque" } },
      schemas: {
        ProblemDetails: schema(ProblemDetailsSchema),
        DirectOpportunityCommand: schema(DirectOpportunityCommandSchema),
        CanonicalOpportunity: schema(CanonicalOpportunitySchema),
        OpportunityListQuery: schema(OpportunityListQuerySchema),
        OpportunityListResponse: schema(OpportunityListResponseSchema),
        SourceExecutionContext: schema(SourceExecutionContextSchema),
        SourceListResponse: schema(SourceListResponseSchema),
        IngestionRunListResponse: schema(IngestionRunListResponseSchema),
      },
    },
  };
}
