import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('RequestValidator');

interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

interface ValidationSchema {
  body?: Record<string, ValidationRule>;
  query?: Record<string, ValidationRule>;
  params?: Record<string, ValidationRule>;
}

const routeSchemas: Map<string, ValidationSchema> = new Map();

routeSchemas.set('POST /chat', {
  body: {
    message: { type: 'string', required: true, minLength: 1, maxLength: 100000 },
  },
});

routeSchemas.set('POST /world-model', {
  body: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 500 },
  },
});

routeSchemas.set('POST /simulation/run', {
  body: {
    worldId: { type: 'string', required: true },
    scenario: { type: 'string', required: true },
  },
});

routeSchemas.set('POST /strategy', {
  body: {
    name: { type: 'string', required: true },
    type: { type: 'string', required: true },
  },
});

routeSchemas.set('POST /user', {
  body: {
    username: { type: 'string', required: true, minLength: 1, maxLength: 100 },
  },
});

routeSchemas.set('POST /custom-llm', {
  body: {
    name: { type: 'string', required: true },
    baseUrl: { type: 'string', required: true },
  },
});

export function requestValidator(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const routeKey = `${request.method} ${request.url.split('?')[0]}`;
  const schema = routeSchemas.get(routeKey);

  if (!schema) {
    done();
    return;
  }

  const errors: string[] = [];

  if (schema.body && request.body) {
    const body = request.body as Record<string, unknown>;
    for (const [field, rule] of Object.entries(schema.body)) {
      const value = body[field];

      if (value === undefined || value === null) {
        if (rule.required) {
          errors.push(`Field '${field}' is required`);
        }
        continue;
      }

      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`Field '${field}' must be a string`);
        continue;
      }

      if (rule.type === 'number' && typeof value !== 'number') {
        errors.push(`Field '${field}' must be a number`);
        continue;
      }

      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`Field '${field}' must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`Field '${field}' must be at most ${rule.maxLength} characters`);
        }
      }

      if (typeof value === 'number') {
        if (rule.minimum !== undefined && value < rule.minimum) {
          errors.push(`Field '${field}' must be at least ${rule.minimum}`);
        }
        if (rule.maximum !== undefined && value > rule.maximum) {
          errors.push(`Field '${field}' must be at most ${rule.maximum}`);
        }
      }
    }
  }

  if (schema.query) {
    const query = request.query as Record<string, unknown>;
    for (const [field, rule] of Object.entries(schema.query)) {
      if (rule.required && (query[field] === undefined || query[field] === null)) {
        errors.push(`Query parameter '${field}' is required`);
      }
    }
  }

  if (errors.length > 0) {
    logger.warn('Request validation failed', {
      route: routeKey,
      errors,
    });
    reply.status(400).send({
      error: 'Validation Error',
      message: errors.join('; '),
      statusCode: 400,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  done();
}
