import { ok, err } from "@paracosm/shared";
import type { Result } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import { Persona } from "./persona.js";
import type {
  InternalPersonaId,
  PersonaMeshEvent,
  PersonaMeshEventName,
  PersonaMeshEventHandler,
} from "./types.js";

export class PersonaRegistry {
  private personas: Map<InternalPersonaId, Persona>;
  private nameIndex: Map<string, InternalPersonaId>;
  private roleIndex: Map<string, Set<InternalPersonaId>>;
  private taskTypeIndex: Map<string, Set<InternalPersonaId>>;
  private eventHandlers: Map<PersonaMeshEventName, Set<PersonaMeshEventHandler>>;
  private version: number;

  constructor() {
    this.personas = new Map();
    this.nameIndex = new Map();
    this.roleIndex = new Map();
    this.taskTypeIndex = new Map();
    this.eventHandlers = new Map();
    this.version = 0;
  }

  register(persona: Persona): Result<true, ValidationError> {
    const validation = persona.validateWithResult();
    if (!validation.ok) {
      return err(new ValidationError(validation.error.message, {
        personaId: persona.getId(),
      }));
    }

    const id = persona.getId();
    if (this.personas.has(id)) {
      return err(new ValidationError("Persona with this id already exists", {
        personaId: id,
      }));
    }

    const name = persona.getName();
    if (this.nameIndex.has(name)) {
      return err(new ValidationError("Persona with this name already exists", {
        personaName: name,
      }));
    }

    this.personas.set(id, persona);
    this.nameIndex.set(name, id);

    const role = persona.getRole();
    if (!this.roleIndex.has(role)) {
      this.roleIndex.set(role, new Set());
    }
    this.roleIndex.get(role)!.add(id);

    for (const taskType of persona.getPreferredTaskTypes()) {
      if (!this.taskTypeIndex.has(taskType)) {
        this.taskTypeIndex.set(taskType, new Set());
      }
      this.taskTypeIndex.get(taskType)!.add(id);
    }

    this.version++;

    this.emit({
      type: "persona:registered",
      timestamp: new Date().toISOString(),
      data: { personaId: id, name, role },
    });

    return ok(true);
  }

  unregister(id: InternalPersonaId): Result<true, ValidationError> {
    const persona = this.personas.get(id);
    if (!persona) {
      return err(new ValidationError("Persona not found", { personaId: id }));
    }

    const name = persona.getName();
    const role = persona.getRole();

    this.personas.delete(id);
    this.nameIndex.delete(name);

    const roleSet = this.roleIndex.get(role);
    if (roleSet) {
      roleSet.delete(id);
      if (roleSet.size === 0) {
        this.roleIndex.delete(role);
      }
    }

    for (const taskType of persona.getPreferredTaskTypes()) {
      const taskSet = this.taskTypeIndex.get(taskType);
      if (taskSet) {
        taskSet.delete(id);
        if (taskSet.size === 0) {
          this.taskTypeIndex.delete(taskType);
        }
      }
    }

    this.version++;

    this.emit({
      type: "persona:unregistered",
      timestamp: new Date().toISOString(),
      data: { personaId: id, name, role },
    });

    return ok(true);
  }

  get(id: InternalPersonaId): Persona | undefined {
    return this.personas.get(id);
  }

  getByName(name: string): Persona | undefined {
    const id = this.nameIndex.get(name);
    if (!id) return undefined;
    return this.personas.get(id);
  }

  list(): Persona[] {
    return Array.from(this.personas.values());
  }

  listByRole(role: string): Persona[] {
    const ids = this.roleIndex.get(role);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.personas.get(id))
      .filter((p): p is Persona => p !== undefined);
  }

  listByTaskType(taskType: string): Persona[] {
    const ids = this.taskTypeIndex.get(taskType);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.personas.get(id))
      .filter((p): p is Persona => p !== undefined);
  }

  resolve(taskType: string): Persona[] {
    const scored: Array<{ persona: Persona; score: number }> = [];

    for (const persona of this.personas.values()) {
      const score = persona.matchesTask(taskType);
      if (score > 0) {
        scored.push({ persona, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.map((s) => s.persona);
  }

  resolveTop(taskType: string, count: number): Persona[] {
    return this.resolve(taskType).slice(0, count);
  }

  hotReload(persona: Persona): Result<true, ValidationError> {
    const validation = persona.validateWithResult();
    if (!validation.ok) {
      return err(new ValidationError(validation.error.message, {
        personaId: persona.getId(),
      }));
    }

    const id = persona.getId();
    const existing = this.personas.get(id);
    if (!existing) {
      return err(new ValidationError("Persona not found for hot reload", {
        personaId: id,
      }));
    }

    const oldName = existing.getName();
    const oldRole = existing.getRole();
    const oldTaskTypes = existing.getPreferredTaskTypes();

    if (oldName !== persona.getName()) {
      this.nameIndex.delete(oldName);
      this.nameIndex.set(persona.getName(), id);
    }

    if (oldRole !== persona.getRole()) {
      const oldRoleSet = this.roleIndex.get(oldRole);
      if (oldRoleSet) {
        oldRoleSet.delete(id);
        if (oldRoleSet.size === 0) {
          this.roleIndex.delete(oldRole);
        }
      }
      if (!this.roleIndex.has(persona.getRole())) {
        this.roleIndex.set(persona.getRole(), new Set());
      }
      this.roleIndex.get(persona.getRole())!.add(id);
    }

    for (const taskType of oldTaskTypes) {
      const taskSet = this.taskTypeIndex.get(taskType);
      if (taskSet) {
        taskSet.delete(id);
        if (taskSet.size === 0) {
          this.taskTypeIndex.delete(taskType);
        }
      }
    }

    for (const taskType of persona.getPreferredTaskTypes()) {
      if (!this.taskTypeIndex.has(taskType)) {
        this.taskTypeIndex.set(taskType, new Set());
      }
      this.taskTypeIndex.get(taskType)!.add(id);
    }

    this.personas.set(id, persona);
    this.version++;

    this.emit({
      type: "persona:updated",
      timestamp: new Date().toISOString(),
      data: { personaId: id, name: persona.getName(), role: persona.getRole() },
    });

    return ok(true);
  }

  registerBuiltInPersonas(factories: Array<() => Persona>): Result<true, ValidationError> {
    for (const factory of factories) {
      const persona = factory();
      const result = this.register(persona);
      if (!result.ok) return result;
    }
    return ok(true);
  }

  count(): number {
    return this.personas.size;
  }

  has(id: InternalPersonaId): boolean {
    return this.personas.has(id);
  }

  hasName(name: string): boolean {
    return this.nameIndex.has(name);
  }

  getRoles(): string[] {
    return Array.from(this.roleIndex.keys());
  }

  getTaskTypes(): string[] {
    return Array.from(this.taskTypeIndex.keys());
  }

  getVersion(): number {
    return this.version;
  }

  clear(): void {
    this.personas.clear();
    this.nameIndex.clear();
    this.roleIndex.clear();
    this.taskTypeIndex.clear();
    this.version++;
  }

  on(event: PersonaMeshEventName, handler: PersonaMeshEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: PersonaMeshEventName, handler: PersonaMeshEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: PersonaMeshEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // swallow handler errors
        }
      }
    }
  }
}
