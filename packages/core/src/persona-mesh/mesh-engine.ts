import type { Persona, PersonaConfig, PersonaRole, DebateResult, PersonaCombination, PersonaActivation } from '@paracosm/shared';
import { generateId, ok, err, type Result, createLogger } from '@paracosm/shared';
import { PersonaRegistry } from './persona-registry.js';
import { PersonaCombiner } from './persona-combiner.js';
import { DebateProtocol } from './debate-protocol.js';
import { DebateScoring } from './debate-scoring.js';
import { DebateAggregator } from './debate-aggregator.js';
import { PersonaLearning } from './persona-learning.js';
import type { MeshConfig, PersonaResponse, MeshResponse, ActivationCriteria, LearningDataPoint } from './types.js';
import { DEFAULT_MESH_CONFIG } from './types.js';
import { ArchitectPersona } from './personas/architect.js';
import { ExecutorPersona } from './personas/executor.js';
import { CriticPersona } from './personas/critic.js';
import { DreamerPersona } from './personas/dreamer.js';
import { CuratorPersona } from './personas/curator.js';

const logger = createLogger('MeshEngine');

export class MeshEngine {
  private config: MeshConfig;
  private registry: PersonaRegistry;
  private combiner: PersonaCombiner;
  private debateProtocol: DebateProtocol;
  private debateScoring: DebateScoring;
  private debateAggregator: DebateAggregator;
  private learning: PersonaLearning;
  private activationLog: PersonaActivation[] = [];
  private listeners: Map<string, Array<(data: unknown) => void>> = new Map();
  private initialized: boolean = false;

  constructor(config: Partial<MeshConfig> = {}) {
    this.config = { ...DEFAULT_MESH_CONFIG, ...config };
    this.registry = new PersonaRegistry();
    this.combiner = new PersonaCombiner();
    this.debateProtocol = new DebateProtocol(this.config);
    this.debateScoring = new DebateScoring();
    this.debateAggregator = new DebateAggregator();
    this.learning = new PersonaLearning(this.config.adaptationRate);
  }

  initialize(): Result<boolean> {
    if (this.initialized) return ok(true);
    const defaultPersonas: Array<{ create: () => Persona; config: PersonaConfig }> = [
      ArchitectPersona,
      ExecutorPersona,
      CriticPersona,
      DreamerPersona,
      CuratorPersona,
    ];
    for (const personaClass of defaultPersonas) {
      const result = this.registry.register(personaClass.config);
      if (!result.ok) {
        logger.warn(`Failed to register default persona: ${result.err}`);
      }
    }
    this.initialized = true;
    logger.info('MeshEngine initialized with default personas');
    return ok(true);
  }

  on(event: string, listener: (data: unknown) => void): () => void {
    const listeners = this.eventListeners.get(event) ?? [];
    listeners.push(listener);
    this.eventListeners.set(event, listeners);
    return () => {
      const list = this.eventListeners.get(event);
      if (list) {
        const idx = list.indexOf(listener);
        if (idx !== -1) list.splice(idx, 1);
      }
    };
  }

  private get eventListeners(): Map<string, Array<(data: unknown) => void>> {
    return this.listeners;
  }

  private emitEvent(event: string, data: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try { listener(data); } catch (error) { logger.error(`Event listener error: ${error}`); }
      }
    }
  }

  registerPersona(config: PersonaConfig): Result<Persona> {
    return this.registry.register(config);
  }

  unregisterPersona(personaId: string): Result<boolean> {
    return this.registry.unregister(personaId);
  }

  activatePersona(personaId: string): Result<Persona> {
    const result = this.registry.activate(personaId);
    if (result.ok) {
      const activation: PersonaActivation = {
        personaId,
        activatedAt: new Date(),
        trigger: 'manual',
        context: 'user_request',
        metadata: {},
      };
      this.activationLog.push(activation);
      this.emitEvent('persona:activated', result.value);
    }
    return result;
  }

  deactivatePersona(personaId: string): Result<Persona> {
    const result = this.registry.deactivate(personaId);
    if (result.ok) {
      const lastActivation = [...this.activationLog].reverse().find((a) => a.personaId === personaId && !a.deactivatedAt);
      if (lastActivation) {
        lastActivation.deactivatedAt = new Date();
        lastActivation.result = 'deactivated';
      }
      this.emitEvent('persona:deactivated', result.value);
    }
    return result;
  }

  selectPersonasForTask(taskType: string, complexity: string = 'medium', maxPersonas?: number): Persona[] {
    const limit = maxPersonas ?? this.config.maxActivePersonas;
    return this.registry.selectForTask(taskType, complexity, limit);
  }

  async processWithPersonas(task: string, taskType: string, complexity: string = 'medium'): Promise<MeshResponse> {
    const startTime = Date.now();
    const selectedPersonas = this.selectPersonasForTask(taskType, complexity);
    if (selectedPersonas.length === 0) {
      return {
        responses: [],
        consensus: 'No personas available for this task',
        confidence: 0,
        duration: Date.now() - startTime,
        metadata: { taskType, complexity },
      };
    }
    const responses: PersonaResponse[] = [];
    for (const persona of selectedPersonas) {
      const responseStart = Date.now();
      const response = this.generatePersonaResponse(persona, task, taskType);
      response.latencyMs = Date.now() - responseStart;
      responses.push(response);
      this.registry.recordInvocation(persona.id, response.confidence > 0.5, response.latencyMs);
      if (this.config.learningEnabled) {
        this.learning.recordDataPoint({
          personaId: persona.id,
          taskId: task,
          taskType,
          success: response.confidence > 0.5,
          confidence: response.confidence,
          latencyMs: response.latencyMs,
          timestamp: new Date(),
          metadata: {},
        });
      }
    }
    let debateResult: DebateResult | undefined;
    if (this.config.debateEnabled && responses.length >= 2) {
      debateResult = await this.runDebate(task, selectedPersonas, responses);
    }
    const consensus = this.computeConsensus(responses);
    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
    this.emitEvent('mesh:processed', { taskType, personaCount: selectedPersonas.length, confidence: avgConfidence });
    return {
      responses,
      consensus: consensus.content,
      confidence: consensus.confidence,
      debateResult,
      duration: Date.now() - startTime,
      metadata: { taskType, complexity, personaCount: selectedPersonas.length },
    };
  }

  private generatePersonaResponse(persona: Persona, task: string, taskType: string): PersonaResponse {
    const role = persona.config.role;
    let content = '';
    let confidence = 0.5;
    let reasoning = '';
    const alternatives: string[] = [];
    switch (role) {
      case 'architect':
        content = `Architectural analysis of: ${task}`;
        confidence = 0.8;
        reasoning = 'Based on structural analysis and design patterns';
        break;
      case 'executor':
        content = `Execution plan for: ${task}`;
        confidence = 0.85;
        reasoning = 'Based on practical implementation considerations';
        break;
      case 'critic':
        content = `Critical review of: ${task}`;
        confidence = 0.7;
        reasoning = 'Based on risk assessment and quality standards';
        break;
      case 'dreamer':
        content = `Creative exploration of: ${task}`;
        confidence = 0.6;
        reasoning = 'Based on innovative and unconventional thinking';
        alternatives.push('Alternative creative approach 1', 'Alternative creative approach 2');
        break;
      case 'curator':
        content = `Synthesized analysis of: ${task}`;
        confidence = 0.75;
        reasoning = 'Based on integration of multiple perspectives';
        break;
      default:
        content = `Analysis of: ${task}`;
        confidence = 0.5;
        reasoning = 'General analysis';
    }
    if (this.config.learningEnabled) {
      const predictedSuccess = this.learning.getPredictedSuccessRate(persona.id, taskType);
      confidence = confidence * 0.7 + predictedSuccess * 0.3;
    }
    return {
      personaId: persona.id,
      content,
      confidence,
      reasoning,
      alternatives,
      latencyMs: 0,
      tokenUsage: { prompt: 0, completion: 0, total: 0 },
      metadata: { role, taskType },
    };
  }

  private async runDebate(topic: string, personas: Persona[], responses: PersonaResponse[]): Promise<DebateResult> {
    const sessionResult = this.debateProtocol.createSession(topic, personas.map((p) => p.id));
    if (!sessionResult.ok) {
      return {
        id: generateId(),
        topic,
        rounds: [],
        consensus: 'Debate session could not be created',
        confidence: 0,
        duration: 0,
        timestamp: new Date(),
      };
    }
    const session = sessionResult.value;
    this.debateProtocol.startSession(session.id);
    for (const response of responses) {
      this.debateProtocol.submitProposal(session.id, {
        personaId: response.personaId,
        content: response.content,
        confidence: response.confidence,
        reasoning: response.reasoning,
        alternatives: response.alternatives,
        metadata: {},
      });
    }
    for (const response of responses) {
      for (const otherResponse of responses) {
        if (response.personaId !== otherResponse.personaId) {
          this.debateProtocol.submitCritique(session.id, {
            personaId: response.personaId,
            targetProposalId: otherResponse.personaId,
            content: `Critique from ${response.personaId} on ${otherResponse.personaId}`,
            severity: 3,
            suggestions: ['Consider alternative approaches'],
            metadata: {},
          });
        }
      }
    }
    this.debateProtocol.completeSession(session.id);
    const completedSession = this.debateProtocol.getSession(session.id);
    return completedSession?.result ?? {
      id: generateId(),
      topic,
      rounds: [],
      consensus: 'Debate completed without result',
      confidence: 0,
      duration: 0,
      timestamp: new Date(),
    };
  }

  private computeConsensus(responses: PersonaResponse[]): { content: string; confidence: number } {
    if (responses.length === 0) return { content: '', confidence: 0 };
    if (responses.length === 1) return { content: responses[0].content, confidence: responses[0].confidence };
    const weightedResponses = responses.map((r) => ({
      response: r,
      weight: r.confidence,
    }));
    const totalWeight = weightedResponses.reduce((sum, w) => sum + w.weight, 0);
    const avgConfidence = totalWeight / weightedResponses.length;
    const bestResponse = weightedResponses.sort((a, b) => b.weight - a.weight)[0];
    return {
      content: bestResponse.response.content,
      confidence: avgConfidence,
    };
  }

  findBestCombination(taskType: string): PersonaCombination | null {
    const activePersonas = this.registry.getActivePersonas();
    return this.combiner.findBestCombination(taskType, activePersonas);
  }

  getPersona(personaId: string): Persona | undefined {
    return this.registry.get(personaId);
  }

  getActivePersonas(): Persona[] {
    return this.registry.getActivePersonas();
  }

  getAllPersonas(): Persona[] {
    return this.registry.getAll();
  }

  getPersonaPerformance(personaId: string): { successRate: number; avgLatency: number; invocationCount: number; trend: string } {
    const persona = this.registry.get(personaId);
    if (!persona) return { successRate: 0, avgLatency: 0, invocationCount: 0, trend: 'unknown' };
    const trend = this.learning.getPerformanceTrend(personaId);
    return {
      successRate: persona.state.successRate,
      avgLatency: persona.state.averageLatencyMs,
      invocationCount: persona.state.invocationCount,
      trend,
    };
  }

  getConfig(): MeshConfig {
    return { ...this.config };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  clear(): void {
    this.registry.clear();
    this.combiner.clear();
    this.debateProtocol.clear();
    this.learning.clear();
    this.activationLog = [];
    this.initialized = false;
    this.emitEvent('mesh:cleared', null);
  }
}
