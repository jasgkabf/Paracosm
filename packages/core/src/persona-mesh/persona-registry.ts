import type { Persona, PersonaConfig, PersonaRole } from '@paracosm/shared';
import { generateId, ok, err, type Result, createLogger } from '@paracosm/shared';
import { createPersona, activatePersona, deactivatePersona, recordPersonaInvocation, isPersonaSuitableForTask, getPersonaPriority } from './persona.js';

const logger = createLogger('PersonaRegistry');

export class PersonaRegistry {
  private personas: Map<string, Persona> = new Map();
  private roleIndex: Map<PersonaRole, Set<string>> = new Map();
  private listeners: Array<(event: string, data: unknown) => void> = [];

  on(listener: (event: string, data: unknown) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: string, data: unknown): void {
    for (const listener of this.listeners) {
      listener(event, data);
    }
  }

  register(config: PersonaConfig): Result<Persona> {
    const persona = createPersona(config);
    this.personas.set(persona.id, persona);
    const roleSet = this.roleIndex.get(config.role) ?? new Set();
    roleSet.add(persona.id);
    this.roleIndex.set(config.role, roleSet);
    logger.info(`Registered persona: ${config.name} (${config.role})`);
    this.emit('persona:registered', persona);
    return ok(persona);
  }

  unregister(personaId: string): Result<boolean> {
    const persona = this.personas.get(personaId);
    if (!persona) {
      return err(new Error(`Persona ${personaId} not found`));
    }
    this.personas.delete(personaId);
    const roleSet = this.roleIndex.get(persona.config.role);
    if (roleSet) {
      roleSet.delete(personaId);
      if (roleSet.size === 0) this.roleIndex.delete(persona.config.role);
    }
    logger.info(`Unregistered persona: ${persona.config.name}`);
    this.emit('persona:unregistered', persona);
    return ok(true);
  }

  get(personaId: string): Persona | undefined {
    return this.personas.get(personaId);
  }

  getByRole(role: PersonaRole): Persona[] {
    const ids = this.roleIndex.get(role);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.personas.get(id))
      .filter((p): p is Persona => p !== undefined);
  }

  getActivePersonas(): Persona[] {
    return Array.from(this.personas.values()).filter((p) => p.state.active);
  }

  activate(personaId: string): Result<Persona> {
    const persona = this.personas.get(personaId);
    if (!persona) {
      return err(new Error(`Persona ${personaId} not found`));
    }
    const updated = activatePersona(persona);
    this.personas.set(personaId, updated);
    this.emit('persona:activated', updated);
    return ok(updated);
  }

  deactivate(personaId: string): Result<Persona> {
    const persona = this.personas.get(personaId);
    if (!persona) {
      return err(new Error(`Persona ${personaId} not found`));
    }
    const updated = deactivatePersona(persona);
    this.personas.set(personaId, updated);
    this.emit('persona:deactivated', updated);
    return ok(updated);
  }

  recordInvocation(personaId: string, success: boolean, latencyMs: number): Result<Persona> {
    const persona = this.personas.get(personaId);
    if (!persona) {
      return err(new Error(`Persona ${personaId} not found`));
    }
    const updated = recordPersonaInvocation(persona, success, latencyMs);
    this.personas.set(personaId, updated);
    return ok(updated);
  }

  selectForTask(taskType: string, complexity: string = 'medium', maxPersonas: number = 5): Persona[] {
    const candidates = Array.from(this.personas.values())
      .filter((p) => p.state.active)
      .map((p) => ({
        persona: p,
        priority: getPersonaPriority(p, taskType),
        suitable: isPersonaSuitableForTask(p, taskType, complexity),
      }))
      .sort((a, b) => {
        if (a.suitable && !b.suitable) return -1;
        if (!a.suitable && b.suitable) return 1;
        return b.priority - a.priority;
      });
    const selected: Persona[] = [];
    const usedRoles = new Set<PersonaRole>();
    for (const candidate of candidates) {
      if (selected.length >= maxPersonas) break;
      if (!usedRoles.has(candidate.persona.config.role) || candidate.suitable) {
        selected.push(candidate.persona);
        usedRoles.add(candidate.persona.config.role);
      }
    }
    return selected;
  }

  getAll(): Persona[] {
    return Array.from(this.personas.values());
  }

  getCount(): number {
    return this.personas.size;
  }

  getActiveCount(): number {
    return this.getActivePersonas().length;
  }

  clear(): void {
    this.personas.clear();
    this.roleIndex.clear();
    this.emit('registry:cleared', null);
  }
}
