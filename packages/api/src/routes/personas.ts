import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface PersonaBody {
  name: string;
  role: string;
  description?: string;
  systemPrompt?: string;
  parameters?: Record<string, unknown>;
}

interface PersonaParams {
  personaId: string;
}

export function registerPersonaRoutes(fastify: FastifyInstance): void {
  fastify.get('/personas', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      personas: [
        { id: 'architect', name: 'Architect', role: 'design', description: 'Designs system architecture' },
        { id: 'critic', name: 'Critic', role: 'review', description: 'Reviews and critiques proposals' },
        { id: 'curator', name: 'Curator', role: 'organize', description: 'Organizes and prioritizes information' },
        { id: 'dreamer', name: 'Dreamer', role: 'ideate', description: 'Generates creative ideas' },
        { id: 'executor', name: 'Executor', role: 'implement', description: 'Implements plans and actions' },
      ],
      total: 5,
    });
  });

  fastify.get('/personas/:personaId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as PersonaParams;
    return reply.send({
      id: params.personaId,
      name: 'Persona',
      role: 'assistant',
      description: 'A persona',
      systemPrompt: '',
      parameters: {},
    });
  });

  fastify.post('/personas', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as PersonaBody;

    if (!body.name || !body.role) {
      return reply.status(400).send({ error: 'name and role are required' });
    }

    return reply.send({
      id: `persona_${Date.now()}`,
      name: body.name,
      role: body.role,
      description: body.description ?? '',
      systemPrompt: body.systemPrompt ?? '',
      parameters: body.parameters ?? {},
      createdAt: new Date().toISOString(),
    });
  });

  fastify.put('/personas/:personaId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as PersonaParams;
    const body = request.body as PersonaBody;
    return reply.send({
      id: params.personaId,
      name: body.name ?? 'Updated Persona',
      role: body.role ?? 'assistant',
      updatedAt: new Date().toISOString(),
    });
  });

  fastify.delete('/personas/:personaId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as PersonaParams;
    return reply.send({ deleted: true, personaId: params.personaId });
  });

  fastify.post('/personas/debate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { topic: string; personas?: string[]; rounds?: number };
    return reply.send({
      id: `debate_${Date.now()}`,
      topic: body.topic,
      participants: body.personas ?? ['architect', 'critic'],
      rounds: body.rounds ?? 3,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  });

  fastify.get('/personas/:personaId/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as PersonaParams;
    return reply.send({
      personaId: params.personaId,
      interactions: [],
      total: 0,
    });
  });
}
