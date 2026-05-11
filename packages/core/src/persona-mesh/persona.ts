import { PersonaRole, PersonaState } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import type { Result } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import type {
  PersonaInternal,
  PersonaCreateConfig,
  InternalPersonaId,
} from "./types.js";

export class Persona {
  private data: PersonaInternal;

  private constructor(data: PersonaInternal) {
    this.data = data;
  }

  static create(config: PersonaCreateConfig): Persona {
    const now = new Date().toISOString();
    const id: InternalPersonaId = config.id ?? generateId();

    const data: PersonaInternal = {
      id,
      name: config.name,
      role: config.role,
      description: config.description,
      systemPrompt: config.systemPrompt ?? Persona.generateSystemPrompt(config),
      traits: config.traits ?? [],
      biases: config.biases ?? [],
      expertise: config.expertise ?? [],
      tools: config.tools ?? [],
      constraints: config.constraints ?? [],
      communicationStyle: config.communicationStyle ?? "professional",
      preferredTaskTypes: config.preferredTaskTypes ?? [],
      weight: config.weight ?? 1.0,
      state: PersonaState.Idle,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    return new Persona(data);
  }

  withSystemPrompt(prompt: string): Persona {
    const updated = this.clone();
    updated.data.systemPrompt = prompt;
    updated.data.updatedAt = new Date().toISOString();
    updated.data.version++;
    return updated;
  }

  withTools(tools: string[]): Persona {
    const updated = this.clone();
    updated.data.tools = [...tools];
    updated.data.updatedAt = new Date().toISOString();
    updated.data.version++;
    return updated;
  }

  withConstraints(constraints: string[]): Persona {
    const updated = this.clone();
    updated.data.constraints = [...constraints];
    updated.data.updatedAt = new Date().toISOString();
    updated.data.version++;
    return updated;
  }

  withWeight(weight: number): Persona {
    const clamped = Math.max(0.1, Math.min(2.0, weight));
    const updated = this.clone();
    updated.data.weight = clamped;
    updated.data.updatedAt = new Date().toISOString();
    updated.data.version++;
    return updated;
  }

  withTraits(traits: Array<{ name: string; intensity: number; description: string }>): Persona {
    const updated = this.clone();
    updated.data.traits = traits.map((t) => ({ ...t }));
    updated.data.updatedAt = new Date().toISOString();
    updated.data.version++;
    return updated;
  }

  withBiases(biases: Array<{ name: string; direction: "positive" | "negative" | "neutral"; strength: number; domain: string }>): Persona {
    const updated = this.clone();
    updated.data.biases = biases.map((b) => ({ ...b }));
    updated.data.updatedAt = new Date().toISOString();
    updated.data.version++;
    return updated;
  }

  withExpertise(expertise: string[]): Persona {
    const updated = this.clone();
    updated.data.expertise = [...expertise];
    updated.data.updatedAt = new Date().toISOString();
    updated.data.version++;
    return updated;
  }

  withPreferredTaskTypes(taskTypes: string[]): Persona {
    const updated = this.clone();
    updated.data.preferredTaskTypes = [...taskTypes];
    updated.data.updatedAt = new Date().toISOString();
    updated.data.version++;
    return updated;
  }

  withCommunicationStyle(style: string): Persona {
    const updated = this.clone();
    updated.data.communicationStyle = style;
    updated.data.updatedAt = new Date().toISOString();
    updated.data.version++;
    return updated;
  }

  validate(): boolean {
    if (!this.data.id || this.data.id.length === 0) return false;
    if (!this.data.name || this.data.name.length === 0) return false;
    if (!this.data.description || this.data.description.length === 0) return false;
    if (!this.data.systemPrompt || this.data.systemPrompt.length === 0) return false;
    if (this.data.weight < 0.1 || this.data.weight > 2.0) return false;

    for (const trait of this.data.traits) {
      if (!trait.name || trait.name.length === 0) return false;
      if (trait.intensity < 0 || trait.intensity > 1) return false;
      if (!trait.description || trait.description.length === 0) return false;
    }

    for (const bias of this.data.biases) {
      if (!bias.name || bias.name.length === 0) return false;
      if (!["positive", "negative", "neutral"].includes(bias.direction)) return false;
      if (bias.strength < 0 || bias.strength > 1) return false;
      if (!bias.domain || bias.domain.length === 0) return false;
    }

    return true;
  }

  validateWithResult(): Result<true, Error> {
    if (!this.data.id || this.data.id.length === 0) {
      return err(new Error("Persona id is required"));
    }
    if (!this.data.name || this.data.name.length === 0) {
      return err(new Error("Persona name is required"));
    }
    if (!this.data.description || this.data.description.length === 0) {
      return err(new Error("Persona description is required"));
    }
    if (!this.data.systemPrompt || this.data.systemPrompt.length === 0) {
      return err(new Error("Persona system prompt is required"));
    }
    if (this.data.weight < 0.1 || this.data.weight > 2.0) {
      return err(new Error("Persona weight must be between 0.1 and 2.0"));
    }
    return ok(true);
  }

  serialize(): Record<string, unknown> {
    return {
      id: this.data.id,
      name: this.data.name,
      role: this.data.role,
      description: this.data.description,
      systemPrompt: this.data.systemPrompt,
      traits: this.data.traits.map((t) => ({ ...t })),
      biases: this.data.biases.map((b) => ({ ...b })),
      expertise: [...this.data.expertise],
      tools: [...this.data.tools],
      constraints: [...this.data.constraints],
      communicationStyle: this.data.communicationStyle,
      preferredTaskTypes: [...this.data.preferredTaskTypes],
      weight: this.data.weight,
      state: this.data.state,
      createdAt: this.data.createdAt,
      updatedAt: this.data.updatedAt,
      version: this.data.version,
    };
  }

  static deserialize(data: Record<string, unknown>): Persona {
    const internal: PersonaInternal = {
      id: data.id as InternalPersonaId,
      name: data.name as string,
      role: data.role as PersonaRole,
      description: data.description as string,
      systemPrompt: data.systemPrompt as string,
      traits: (data.traits as Array<{ name: string; intensity: number; description: string }>) ?? [],
      biases: (data.biases as Array<{ name: string; direction: "positive" | "negative" | "neutral"; strength: number; domain: string }>) ?? [],
      expertise: (data.expertise as string[]) ?? [],
      tools: (data.tools as string[]) ?? [],
      constraints: (data.constraints as string[]) ?? [],
      communicationStyle: (data.communicationStyle as string) ?? "professional",
      preferredTaskTypes: (data.preferredTaskTypes as string[]) ?? [],
      weight: (data.weight as number) ?? 1.0,
      state: (data.state as PersonaState) ?? PersonaState.Idle,
      createdAt: (data.createdAt as string) ?? new Date().toISOString(),
      updatedAt: (data.updatedAt as string) ?? new Date().toISOString(),
      version: (data.version as number) ?? 1,
    };
    return new Persona(internal);
  }

  matchesTask(taskType: string): number {
    let score = 0;

    for (const preferred of this.data.preferredTaskTypes) {
      if (preferred === taskType) {
        score += 1.0;
      } else if (preferred.includes(taskType) || taskType.includes(preferred)) {
        score += 0.5;
      }
    }

    for (const exp of this.data.expertise) {
      if (exp === taskType) {
        score += 0.8;
      } else if (exp.includes(taskType) || taskType.includes(exp)) {
        score += 0.3;
      }
    }

    const roleAffinity = Persona.getRoleTaskAffinity(this.data.role, taskType);
    score += roleAffinity;

    return Math.min(score, 2.0) * this.data.weight;
  }

  static getRoleTaskAffinity(role: PersonaRole, taskType: string): number {
    const affinityMap: Record<string, Record<string, number>> = {
      [PersonaRole.Strategist]: { complex_reasoning: 0.9, analysis: 0.8, planning: 0.9 },
      [PersonaRole.Critic]: { analysis: 0.9, persona_debate: 0.8, review: 0.9 },
      [PersonaRole.Innovator]: { creative: 0.9, persona_debate: 0.7, exploration: 0.8 },
      [PersonaRole.Pragmatist]: { code_generation: 0.8, simple_chat: 0.7, implementation: 0.9 },
      [PersonaRole.Synthesizer]: { analysis: 0.8, simulation: 0.7, synthesis: 0.9 },
      [PersonaRole.Analyst]: { analysis: 0.9, complex_reasoning: 0.8, data: 0.8 },
      [PersonaRole.Optimist]: { creative: 0.7, persona_debate: 0.6, exploration: 0.7 },
      [PersonaRole.Pessimist]: { analysis: 0.7, review: 0.8, risk_assessment: 0.9 },
      [PersonaRole.Explorer]: { creative: 0.8, exploration: 0.9, research: 0.8 },
      [PersonaRole.Guardian]: { review: 0.9, risk_assessment: 0.8, security: 0.9 },
    };

    const roleAffinities = affinityMap[role];
    if (!roleAffinities) return 0;

    let bestScore = 0;
    for (const [key, value] of Object.entries(roleAffinities)) {
      if (key === taskType || taskType.includes(key) || key.includes(taskType)) {
        bestScore = Math.max(bestScore, value);
      }
    }
    return bestScore;
  }

  private static generateSystemPrompt(config: PersonaCreateConfig): string {
    const parts: string[] = [];

    parts.push(`You are ${config.name}, a ${config.role} persona.`);

    if (config.description) {
      parts.push(`Your role: ${config.description}`);
    }

    if (config.expertise && config.expertise.length > 0) {
      parts.push(`Your areas of expertise: ${config.expertise.join(", ")}.`);
    }

    if (config.traits && config.traits.length > 0) {
      const traitDescriptions = config.traits
        .filter((t) => t.intensity >= 0.5)
        .map((t) => t.description || t.name);
      if (traitDescriptions.length > 0) {
        parts.push(`Key traits: ${traitDescriptions.join("; ")}.`);
      }
    }

    if (config.constraints && config.constraints.length > 0) {
      parts.push(`You must adhere to these constraints: ${config.constraints.join("; ")}.`);
    }

    parts.push("Respond in a " + (config.communicationStyle ?? "professional") + " manner.");
    parts.push("Focus on providing actionable, well-reasoned contributions.");

    return parts.join(" ");
  }

  getState(): PersonaState {
    return this.data.state;
  }

  setState(state: PersonaState): Persona {
    const updated = this.clone();
    updated.data.state = state;
    updated.data.updatedAt = new Date().toISOString();
    return updated;
  }

  getId(): InternalPersonaId {
    return this.data.id;
  }

  getName(): string {
    return this.data.name;
  }

  getRole(): PersonaRole {
    return this.data.role;
  }

  getDescription(): string {
    return this.data.description;
  }

  getSystemPrompt(): string {
    return this.data.systemPrompt;
  }

  getTraits(): Array<{ name: string; intensity: number; description: string }> {
    return [...this.data.traits];
  }

  getBiases(): Array<{ name: string; direction: "positive" | "negative" | "neutral"; strength: number; domain: string }> {
    return [...this.data.biases];
  }

  getExpertise(): string[] {
    return [...this.data.expertise];
  }

  getTools(): string[] {
    return [...this.data.tools];
  }

  getConstraints(): string[] {
    return [...this.data.constraints];
  }

  getCommunicationStyle(): string {
    return this.data.communicationStyle;
  }

  getPreferredTaskTypes(): string[] {
    return [...this.data.preferredTaskTypes];
  }

  getWeight(): number {
    return this.data.weight;
  }

  getVersion(): number {
    return this.data.version;
  }

  getCreatedAt(): string {
    return this.data.createdAt;
  }

  getUpdatedAt(): string {
    return this.data.updatedAt;
  }

  toInternal(): PersonaInternal {
    return { ...this.data };
  }

  private clone(): Persona {
    return new Persona({
      ...this.data,
      traits: this.data.traits.map((t) => ({ ...t })),
      biases: this.data.biases.map((b) => ({ ...b })),
      expertise: [...this.data.expertise],
      tools: [...this.data.tools],
      constraints: [...this.data.constraints],
      preferredTaskTypes: [...this.data.preferredTaskTypes],
    });
  }
}
