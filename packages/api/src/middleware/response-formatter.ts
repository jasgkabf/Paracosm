import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface ResponseMeta {
  requestId: string;
  timestamp: string;
  duration?: number;
}

interface FormattedResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  meta: ResponseMeta;
}

interface PaginationMeta extends ResponseMeta {
  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
}

interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
  meta: PaginationMeta;
}

function formatSuccess<T>(data: T, meta: ResponseMeta): FormattedResponse<T> {
  return {
    success: true,
    data,
    meta,
  };
}

function formatError(code: string, message: string, details: Record<string, unknown>, meta: ResponseMeta): FormattedResponse {
  return {
    success: false,
    error: { code, message, details },
    meta,
  };
}

function formatPaginated<T>(
  items: T[],
  total: number,
  offset: number,
  limit: number,
  meta: ResponseMeta
): PaginatedResponse<T> {
  return {
    success: true,
    data: {
      items,
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
    },
    meta: {
      ...meta,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
    },
  };
}

function formatMetadata(request: FastifyRequest, startTime?: number): ResponseMeta {
  return {
    requestId: request.id,
    timestamp: new Date().toISOString(),
    duration: startTime ? Date.now() - startTime : undefined,
  };
}

export async function responseFormatter(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply, payload: string) => {
    const contentType = reply.getHeader("content-type") as string | undefined;

    if (contentType && (
      contentType.includes("text/event-stream") ||
      contentType.includes("application/octet-stream") ||
      contentType.includes("multipart/")
    )) {
      return payload;
    }

    if (reply.statusCode === 204) {
      return payload;
    }

    return payload;
  });
}

export { formatSuccess, formatError, formatPaginated, formatMetadata };
export type { FormattedResponse, PaginatedResponse, ResponseMeta, PaginationMeta };
