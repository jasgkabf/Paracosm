export enum CSEPhase {
  CONSTRUCT = 'CONSTRUCT',
  SIMULATE = 'SIMULATE',
  EXECUTE = 'EXECUTE',
  REFLECT = 'REFLECT',
  EVOLVE = 'EVOLVE',
}

export interface CSEContext {
  sessionId: string;
  userId: string;
  query: string;
  worldModelSnapshot?: Record<string, unknown>;
  activePersonas: string[];
  availableTools: string[];
  budgetRemaining: number;
  tokenBudget: number;
  tokensUsed: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CSEState {
  phase: CSEPhase;
  context: CSEContext;
  phaseHistory: Array<{
    phase: CSEPhase;
    enteredAt: Date;
    exitedAt?: Date;
    duration?: number;
  }>;
  iteration: number;
  maxIterations: number;
  startedAt: Date;
  lastUpdatedAt: Date;
}

export interface ConstructResult {
  phase: CSEPhase.CONSTRUCT;
  entitiesCreated: number;
  relationsCreated: number;
  constraintsIdentified: number;
  goalsExtracted: number;
  worldModelVersion: number;
  duration: number;
  metadata: Record<string, unknown>;
}

export interface SimulateResult {
  phase: CSEPhase.SIMULATE;
  pathsExplored: number;
  bestPathScore: number;
  worstPathScore: number;
  averagePathScore: number;
  risksIdentified: number;
  duration: number;
  metadata: Record<string, unknown>;
}

export interface ExecuteResult {
  phase: CSEPhase.EXECUTE;
  stepsCompleted: number;
  stepsTotal: number;
  successRate: number;
  toolsUsed: string[];
  tokensConsumed: number;
  duration: number;
  metadata: Record<string, unknown>;
}

export interface ReflectResult {
  phase: CSEPhase.REFLECT;
  lessonsLearned: string[];
  improvementsIdentified: number;
  performanceScore: number;
  anomaliesDetected: string[];
  feedbackGenerated: string[];
  duration: number;
  metadata: Record<string, unknown>;
}

export interface EvolveResult {
  phase: CSEPhase.EVOLVE;
  genesMutated: number;
  genesCreated: number;
  fitnessImprovement: number;
  diversityChange: number;
  generation: number;
  duration: number;
  metadata: Record<string, unknown>;
}
