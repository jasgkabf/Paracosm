import type {
  AnalysisResult,
  ContextPlan,
} from "./../types.js";
import {
  EntityType,
  RelationType,
  GoalPriority,
  GoalState,
  ConstraintType,
  ConstraintStatus,
} from "@paracosm/shared";
import type {
  ConstructResult,
  WorldModelState,
  Entity,
  EntityId,
  GoalId,
  ConstraintId,
  Goal,
  Constraint,
  PersonaCombination,
  PersonaId,
} from "@paracosm/shared";
import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { generateId, generateUUID } from "@paracosm/shared";

interface EntityCandidate {
  name: string;
  type: EntityType;
  description: string;
  confidence: number;
  properties: Array<{ key: string; value: unknown; type: "string" | "number" | "boolean" | "object" | "array" }>;
  tags: string[];
}

interface RelationCandidate {
  sourceName: string;
  targetName: string;
  type: RelationType;
  label: string;
  weight: number;
  confidence: number;
}

interface GoalCandidate {
  name: string;
  description: string;
  priority: GoalPriority;
  successCriteria: string;
  deadline: string | null;
}

interface ConstraintCandidate {
  name: string;
  type: ConstraintType;
  description: string;
  expression: string;
  priority: number;
  scope: string[];
}

const ENTITY_TYPE_KEYWORDS: Record<string, EntityType> = {
  user: EntityType.Agent,
  agent: EntityType.Agent,
  person: EntityType.Agent,
  system: EntityType.Agent,
  bot: EntityType.Agent,
  resource: EntityType.Resource,
  data: EntityType.Resource,
  file: EntityType.Resource,
  database: EntityType.Resource,
  api: EntityType.Resource,
  service: EntityType.Resource,
  location: EntityType.Location,
  place: EntityType.Location,
  server: EntityType.Location,
  environment: EntityType.Location,
  event: EntityType.Event,
  action: EntityType.Event,
  trigger: EntityType.Event,
  schedule: EntityType.Event,
  concept: EntityType.Concept,
  idea: EntityType.Concept,
  model: EntityType.Concept,
  theory: EntityType.Concept,
  organization: EntityType.Organization,
  team: EntityType.Organization,
  group: EntityType.Organization,
  company: EntityType.Organization,
  artifact: EntityType.Artifact,
  document: EntityType.Artifact,
  report: EntityType.Artifact,
  code: EntityType.Artifact,
  process: EntityType.Process,
  workflow: EntityType.Process,
  pipeline: EntityType.Process,
  procedure: EntityType.Process,
};

const RELATION_KEYWORDS: Record<string, RelationType> = {
  depends: RelationType.DependsOn,
  requires: RelationType.DependsOn,
  needs: RelationType.DependsOn,
  influences: RelationType.Influences,
  affects: RelationType.Influences,
  impacts: RelationType.Influences,
  contains: RelationType.Contains,
  includes: RelationType.Contains,
  has: RelationType.Contains,
  belongs: RelationType.BelongsTo,
  part: RelationType.BelongsTo,
  member: RelationType.BelongsTo,
  precedes: RelationType.Precedes,
  before: RelationType.Precedes,
  enables: RelationType.Enables,
  allows: RelationType.Enables,
  supports: RelationType.Enables,
  inhibits: RelationType.Inhibits,
  blocks: RelationType.Inhibits,
  prevents: RelationType.Inhibits,
  transforms: RelationType.Transforms,
  converts: RelationType.Transforms,
  changes: RelationType.Transforms,
  communicates: RelationType.Communicates,
  sends: RelationType.Communicates,
  receives: RelationType.Communicates,
  competes: RelationType.Competes,
  rivals: RelationType.Competes,
};

export class ConstructPhase {
  private analysisCache: Map<string, AnalysisResult>;

  constructor() {
    this.analysisCache = new Map();
  }

  execute(input: { userInput: string; worldModel: WorldModelState }): ConstructResult {
    const startTime = Date.now();
    const { userInput, worldModel } = input;

    const analysis = this.analyzeInput(userInput);
    const updatedWorldModel = this.cloneWorldModel(worldModel);
    this.updateWorldModel(analysis, updatedWorldModel);

    const goals = this.extractGoals(analysis);
    const constraints = this.identifyConstraints(analysis);

    for (const goal of goals) {
      updatedWorldModel.goalStack.goals.set(goal.id as GoalId, goal);
      if (goal.state === GoalState.Active) {
        updatedWorldModel.goalStack.activeGoals.push(goal.id as GoalId);
      }
    }

    for (const constraint of constraints) {
      updatedWorldModel.constraintMap.constraints.set(constraint.id as ConstraintId, constraint);
      for (const scopeId of constraint.scope) {
        const existing = updatedWorldModel.constraintMap.entityConstraints.get(scopeId as EntityId);
        if (existing) {
          existing.push(constraint.id as ConstraintId);
        } else {
          updatedWorldModel.constraintMap.entityConstraints.set(scopeId as EntityId, [constraint.id as ConstraintId]);
        }
      }
    }

    const entitiesCreated = analysis.entities.length;
    const relationsCreated = 0;
    const constraintsIdentified = constraints.length;
    const goalsDefined = goals.length;

    return {
      worldModel: updatedWorldModel,
      entitiesCreated,
      relationsCreated,
      constraintsIdentified,
      goalsDefined,
      assumptions: analysis.assumptions,
      confidence: this.calculateConfidence(analysis),
      duration: Date.now() - startTime,
    };
  }

  analyzeInput(userInput: string): AnalysisResult {
    const cacheKey = userInput.substring(0, 200);
    const cached = this.analysisCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const entities = this.extractEntityCandidates(userInput);
    const keywords = this.extractKeywords(userInput);
    const sentiment = this.analyzeSentiment(userInput);
    const complexity = this.assessComplexity(userInput, entities);
    const domain = this.identifyDomain(keywords);
    const urgency = this.assessUrgency(userInput);
    const scope = this.assessScope(userInput, entities);
    const assumptions = this.generateAssumptions(userInput, entities);
    const ambiguities = this.identifyAmbiguities(userInput);

    const intent = this.determineIntent(userInput, keywords);

    const result: AnalysisResult = {
      intent,
      entities: entities.map((e) => ({
        name: e.name,
        type: e.type,
        confidence: e.confidence,
      })),
      keywords,
      sentiment,
      complexity,
      domain,
      urgency,
      scope,
      assumptions,
      ambiguities,
    };

    this.analysisCache.set(cacheKey, result);
    return result;
  }

  updateWorldModel(analysis: AnalysisResult, worldModel: WorldModelState): void {
    for (const entityInfo of analysis.entities) {
      const existingEntity = this.findEntityByName(worldModel, entityInfo.name);
      if (!existingEntity) {
        const now = new Date().toISOString();
        const entity: Entity = {
          id: generateId() as EntityId,
          name: entityInfo.name,
          type: entityInfo.type as EntityType,
          description: `Auto-extracted entity: ${entityInfo.name}`,
          properties: [],
          tags: [entityInfo.type, "auto-extracted"],
          metadata: { confidence: entityInfo.confidence, source: "construct" },
          parentId: null,
          childIds: [],
          createdAt: now,
          updatedAt: now,
        };
        worldModel.entityGraph.entities.set(entity.id as EntityId, entity);
      }
    }

    worldModel.version++;
    worldModel.checksum = generateId();
  }

  extractGoals(analysis: AnalysisResult): Goal[] {
    const goals: Goal[] = [];
    const now = new Date().toISOString();

    const primaryGoal = this.createGoalFromAnalysis(analysis, now);
    goals.push(primaryGoal);

    if (analysis.scope === "broad" || analysis.scope === "moderate") {
      const subGoals = this.decomposeGoal(primaryGoal, analysis, now);
      for (const subGoal of subGoals) {
        primaryGoal.subGoalIds.push(subGoal.id as GoalId);
        subGoal.parentGoalId = primaryGoal.id as GoalId;
        goals.push(subGoal);
      }
    }

    for (const ambiguity of analysis.ambiguities) {
      const clarificationGoal: Goal = {
        id: generateId() as GoalId,
        name: `Clarify: ${ambiguity}`,
        description: `Resolve ambiguity: ${ambiguity}`,
        priority: GoalPriority.High,
        state: GoalState.Pending,
        parentGoalId: primaryGoal.id as GoalId,
        subGoalIds: [],
        constraints: [],
        successCriteria: `Ambiguity "${ambiguity}" is resolved`,
        progress: 0,
        deadline: null,
        assignee: null,
        createdAt: now,
        updatedAt: now,
      };
      goals.push(clarificationGoal);
    }

    return goals;
  }

  identifyConstraints(analysis: AnalysisResult): Constraint[] {
    const constraints: Constraint[] = [];
    const now = new Date().toISOString();

    if (analysis.urgency >= 0.8) {
      constraints.push({
        id: generateId() as ConstraintId,
        name: "Time Constraint",
        type: ConstraintType.Temporal,
        status: ConstraintStatus.Active,
        description: "High urgency requires rapid execution",
        expression: "execution_time < deadline",
        priority: 1,
        penalty: 10,
        scope: [],
        createdAt: now,
        updatedAt: now,
      });
    }

    if (analysis.complexity >= 0.7) {
      constraints.push({
        id: generateId() as ConstraintId,
        name: "Complexity Budget",
        type: ConstraintType.Resource,
        status: ConstraintStatus.Active,
        description: "Complex task requires bounded resource allocation",
        expression: "resource_usage <= complexity_budget",
        priority: 2,
        penalty: 5,
        scope: [],
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const assumption of analysis.assumptions) {
      constraints.push({
        id: generateId() as ConstraintId,
        name: `Assumption: ${assumption.substring(0, 50)}`,
        type: ConstraintType.Soft,
        status: ConstraintStatus.Active,
        description: `Assumption constraint: ${assumption}`,
        expression: `assumption_valid("${assumption}")`,
        priority: 3,
        penalty: 2,
        scope: [],
        createdAt: now,
        updatedAt: now,
      });
    }

    return constraints;
  }

  planContext(analysis: AnalysisResult): ContextPlan {
    const requiredEntities = analysis.entities.map((e) => e.name);
    const requiredGoals: string[] = [];
    const requiredConstraints: string[] = [];
    const requiredRelations: string[] = [];

    const estimatedTokens = Math.ceil(
      requiredEntities.length * 65 +
      requiredRelations.length * 26 +
      requiredGoals.length * 39 +
      requiredConstraints.length * 32 +
      200
    );

    const priorityOrder = [...requiredEntities];

    return {
      requiredEntities,
      requiredRelations,
      requiredGoals,
      requiredConstraints,
      estimatedTokens,
      priorityOrder,
    };
  }

  selectPersonas(
    analysis: AnalysisResult,
    registry: Map<string, { id: string; role: string; expertise: string[] }>
  ): PersonaCombination {
    const selectedIds: PersonaId[] = [];
    const requiredExpertise = new Set<string>();

    if (analysis.complexity > 0.7) requiredExpertise.add("analytical");
    if (analysis.urgency > 0.7) requiredExpertise.add("pragmatic");
    if (analysis.scope === "broad") requiredExpertise.add("exploratory");
    if (analysis.sentiment === "negative") requiredExpertise.add("optimistic");

    requiredExpertise.add("critical");
    requiredExpertise.add("strategic");

    for (const [_, persona] of registry) {
      const hasRelevantExpertise = persona.expertise.some((e) => requiredExpertise.has(e));
      if (hasRelevantExpertise && selectedIds.length < 5) {
        selectedIds.push(persona.id as PersonaId);
      }
    }

    if (selectedIds.length < 2) {
      for (const [_, persona] of registry) {
        if (selectedIds.length < 3 && !selectedIds.includes(persona.id as PersonaId)) {
          selectedIds.push(persona.id as PersonaId);
        }
      }
    }

    const synergyScore = this.calculateSynergy(selectedIds, registry);
    const coverageScore = this.calculateCoverage(selectedIds, registry, requiredExpertise);
    const conflictScore = this.calculateConflict(selectedIds, registry);

    return {
      id: generateId(),
      personaIds: selectedIds,
      synergyScore,
      coverageScore,
      conflictScore,
      recommended: synergyScore > 0.5 && coverageScore > 0.6 && conflictScore < 0.3,
    };
  }

  private extractEntityCandidates(input: string): EntityCandidate[] {
    const candidates: EntityCandidate[] = [];
    const words = input.split(/\s+/);
    const processedNames = new Set<string>();

    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
      if (word.length < 2) continue;

      const matchedType = this.matchEntityType(word);
      if (matchedType && !processedNames.has(word)) {
        processedNames.add(word);
        candidates.push({
          name: word,
          type: matchedType,
          description: `Identified as ${matchedType} from input`,
          confidence: 0.7,
          properties: [],
          tags: [matchedType],
        });
      }
    }

    const bigrams = this.extractBigrams(words);
    for (const bigram of bigrams) {
      const matchedType = this.matchEntityType(bigram);
      if (matchedType && !processedNames.has(bigram)) {
        processedNames.add(bigram);
        candidates.push({
          name: bigram,
          type: matchedType,
          description: `Identified as ${matchedType} from input`,
          confidence: 0.6,
          properties: [],
          tags: [matchedType],
        });
      }
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  private matchEntityType(word: string): EntityType | null {
    const lower = word.toLowerCase();
    for (const [keyword, type] of Object.entries(ENTITY_TYPE_KEYWORDS)) {
      if (lower.includes(keyword) || keyword.includes(lower)) {
        return type;
      }
    }
    return null;
  }

  private extractBigrams(words: string[]): string[] {
    const bigrams: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      const clean1 = words[i].replace(/[^a-zA-Z0-9]/g, "");
      const clean2 = words[i + 1].replace(/[^a-zA-Z0-9]/g, "");
      if (clean1.length > 1 && clean2.length > 1) {
        bigrams.push(`${clean1}_${clean2}`);
      }
    }
    return bigrams;
  }

  private extractKeywords(input: string): string[] {
    const stopWords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "shall", "can", "need", "dare", "ought",
      "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
      "as", "into", "through", "during", "before", "after", "above", "below",
      "between", "out", "off", "over", "under", "again", "further", "then",
      "once", "here", "there", "when", "where", "why", "how", "all", "each",
      "every", "both", "few", "more", "most", "other", "some", "such", "no",
      "nor", "not", "only", "own", "same", "so", "than", "too", "very",
      "just", "because", "but", "and", "or", "if", "while", "about", "up",
      "it", "its", "this", "that", "these", "those", "i", "me", "my", "we",
      "our", "you", "your", "he", "him", "his", "she", "her", "they", "them",
      "their", "what", "which", "who", "whom",
    ]);

    return input
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z0-9_-]/g, ""))
      .filter((w) => w.length > 2 && !stopWords.has(w));
  }

  private analyzeSentiment(input: string): "positive" | "negative" | "neutral" | "mixed" {
    const positiveWords = ["good", "great", "excellent", "best", "love", "amazing", "wonderful", "fantastic", "perfect", "improve", "enhance", "optimize", "success", "achieve", "benefit"];
    const negativeWords = ["bad", "terrible", "worst", "hate", "awful", "horrible", "fail", "error", "bug", "broken", "crash", "problem", "issue", "risk", "danger", "threat", "concern"];

    const lower = input.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of positiveWords) {
      if (lower.includes(word)) positiveCount++;
    }
    for (const word of negativeWords) {
      if (lower.includes(word)) negativeCount++;
    }

    if (positiveCount > 0 && negativeCount > 0) return "mixed";
    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  }

  private assessComplexity(input: string, entities: EntityCandidate[]): number {
    let complexity = 0;

    complexity += Math.min(entities.length / 10, 0.3);
    complexity += Math.min(input.split(/\s+/).length / 100, 0.2);

    const conditionalWords = ["if", "unless", "except", "however", "but", "although", "while", "whereas"];
    const lower = input.toLowerCase();
    for (const word of conditionalWords) {
      if (lower.includes(word)) complexity += 0.05;
    }

    const listIndicators = ["and", "or", ",", ";"];
    let listCount = 0;
    for (const indicator of listIndicators) {
      const regex = new RegExp(indicator === "," || indicator === ";" ? `\\${indicator}` : indicator, "g");
      const matches = lower.match(regex);
      listCount += matches ? matches.length : 0;
    }
    complexity += Math.min(listCount / 20, 0.15);

    return Math.min(complexity, 1);
  }

  private identifyDomain(keywords: string[]): string {
    const domainKeywords: Record<string, string[]> = {
      technical: ["code", "system", "api", "database", "server", "network", "deploy", "build", "test"],
      creative: ["design", "art", "story", "write", "create", "imagine", "visual", "compose"],
      analytical: ["data", "analyze", "statistics", "trend", "metric", "measure", "report", "insight"],
      social: ["team", "user", "customer", "community", "collaborate", "communicate", "feedback"],
      strategic: ["plan", "goal", "objective", "strategy", "roadmap", "vision", "mission", "priority"],
    };

    let bestDomain = "general";
    let bestScore = 0;

    for (const [domain, domainWords] of Object.entries(domainKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (domainWords.some((dw) => keyword.includes(dw) || dw.includes(keyword))) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    }

    return bestDomain;
  }

  private assessUrgency(input: string): number {
    const urgentWords = ["urgent", "asap", "immediately", "critical", "emergency", "now", "deadline", "overdue", "escalate"];
    const moderateWords = ["soon", "important", "priority", "needed", "required", "should"];
    const lower = input.toLowerCase();

    let urgency = 0.3;

    for (const word of urgentWords) {
      if (lower.includes(word)) urgency += 0.2;
    }
    for (const word of moderateWords) {
      if (lower.includes(word)) urgency += 0.1;
    }

    if (lower.includes("!")) urgency += 0.05;
    if (/[A-Z]{3,}/.test(input)) urgency += 0.1;

    return Math.min(urgency, 1);
  }

  private assessScope(input: string, entities: EntityCandidate[]): "narrow" | "moderate" | "broad" {
    if (entities.length <= 2 && input.split(/\s+/).length < 20) return "narrow";
    if (entities.length >= 5 || input.split(/\s+/).length > 80) return "broad";
    return "moderate";
  }

  private generateAssumptions(input: string, entities: EntityCandidate[]): string[] {
    const assumptions: string[] = [];

    assumptions.push("Input is accurately representing the user's intent");

    if (entities.length > 0) {
      assumptions.push(`Identified entities (${entities.map((e) => e.name).join(", ")}) are relevant to the task`);
    }

    const lower = input.toLowerCase();
    if (!lower.includes("not") && !lower.includes("except") && !lower.includes("exclude")) {
      assumptions.push("No explicit exclusions were stated");
    }

    if (!lower.includes("budget") && !lower.includes("cost") && !lower.includes("limit")) {
      assumptions.push("No explicit resource constraints were stated");
    }

    assumptions.push("The current world model state is consistent and up-to-date");

    return assumptions;
  }

  private identifyAmbiguities(input: string): string[] {
    const ambiguities: string[] = [];
    const lower = input.toLowerCase();

    const vagueTerms = ["something", "somehow", "stuff", "things", "it", "that", "they", "them"];
    for (const term of vagueTerms) {
      if (lower.includes(` ${term} `) || lower.startsWith(`${term} `) || lower.endsWith(` ${term}`)) {
        ambiguities.push(`Vague reference: "${term}"`);
      }
    }

    if (lower.includes(" or ") && !lower.includes("either")) {
      ambiguities.push("Disjunctive statement without clear exclusivity");
    }

    if (lower.includes("maybe") || lower.includes("perhaps") || lower.includes("might")) {
      ambiguities.push("Uncertain modal qualifier detected");
    }

    return ambiguities;
  }

  private determineIntent(input: string, keywords: string[]): string {
    const lower = input.toLowerCase();

    const intentPatterns: Array<{ pattern: RegExp; intent: string }> = [
      { pattern: /^(create|build|make|generate|design|develop|implement)/i, intent: "create" },
      { pattern: /^(analyze|examine|investigate|study|review|assess)/i, intent: "analyze" },
      { pattern: /^(fix|repair|resolve|solve|debug|troubleshoot)/i, intent: "fix" },
      { pattern: /^(improve|optimize|enhance|refine|upgrade)/i, intent: "improve" },
      { pattern: /^(plan|schedule|organize|arrange|coordinate)/i, intent: "plan" },
      { pattern: /^(find|search|locate|discover|identify)/i, intent: "search" },
      { pattern: /^(explain|describe|clarify|define|elaborate)/i, intent: "explain" },
      { pattern: /^(compare|contrast|evaluate|benchmark)/i, intent: "compare" },
      { pattern: /^(delete|remove|clean|purge|clear)/i, intent: "delete" },
      { pattern: /^(move|transfer|migrate|deploy|distribute)/i, intent: "move" },
    ];

    for (const { pattern, intent } of intentPatterns) {
      if (pattern.test(input.trim())) {
        return intent;
      }
    }

    if (keywords.length > 0) {
      return `action_involving_${keywords[0]}`;
    }

    return "general_query";
  }

  private createGoalFromAnalysis(analysis: AnalysisResult, now: string): Goal {
    return {
      id: generateId() as GoalId,
      name: `Primary: ${analysis.intent}`,
      description: `Achieve the user's intent: ${analysis.intent}`,
      priority: GoalPriority.Critical,
      state: GoalState.Active,
      parentGoalId: null,
      subGoalIds: [],
      constraints: [],
      successCriteria: `Successfully ${analysis.intent} based on user input`,
      progress: 0,
      deadline: analysis.urgency > 0.8 ? new Date(Date.now() + 3600000).toISOString() : null,
      assignee: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private decomposeGoal(parentGoal: Goal, analysis: AnalysisResult, now: string): Goal[] {
    const subGoals: Goal[] = [];

    const understandingGoal: Goal = {
      id: generateId() as GoalId,
      name: "Understand requirements",
      description: `Fully understand the requirements for: ${analysis.intent}`,
      priority: GoalPriority.High,
      state: GoalState.Pending,
      parentGoalId: parentGoal.id as GoalId,
      subGoalIds: [],
      constraints: [],
      successCriteria: "All requirements are clearly understood and documented",
      progress: 0,
      deadline: null,
      assignee: null,
      createdAt: now,
      updatedAt: now,
    };
    subGoals.push(understandingGoal);

    const executionGoal: Goal = {
      id: generateId() as GoalId,
      name: "Execute plan",
      description: `Execute the plan for: ${analysis.intent}`,
      priority: GoalPriority.High,
      state: GoalState.Pending,
      parentGoalId: parentGoal.id as GoalId,
      subGoalIds: [],
      constraints: [],
      successCriteria: "Plan is executed successfully",
      progress: 0,
      deadline: null,
      assignee: null,
      createdAt: now,
      updatedAt: now,
    };
    subGoals.push(executionGoal);

    if (analysis.ambiguities.length > 0) {
      const clarificationGoal: Goal = {
        id: generateId() as GoalId,
        name: "Resolve ambiguities",
        description: `Resolve ${analysis.ambiguities.length} identified ambiguities`,
        priority: GoalPriority.Medium,
        state: GoalState.Pending,
        parentGoalId: parentGoal.id as GoalId,
        subGoalIds: [],
        constraints: [],
        successCriteria: "All ambiguities are resolved",
        progress: 0,
        deadline: null,
        assignee: null,
        createdAt: now,
        updatedAt: now,
      };
      subGoals.push(clarificationGoal);
    }

    return subGoals;
  }

  private calculateConfidence(analysis: AnalysisResult): number {
    let confidence = 0.5;

    if (analysis.entities.length > 0) confidence += 0.1;
    if (analysis.ambiguities.length === 0) confidence += 0.1;
    if (analysis.intent !== "general_query") confidence += 0.15;
    if (analysis.keywords.length >= 3) confidence += 0.05;
    if (analysis.assumptions.length <= 3) confidence += 0.1;

    return Math.min(confidence, 1);
  }

  private findEntityByName(worldModel: WorldModelState, name: string): Entity | null {
    for (const [_, entity] of worldModel.entityGraph.entities) {
      if (entity.name.toLowerCase() === name.toLowerCase()) {
        return entity;
      }
    }
    return null;
  }

  private cloneWorldModel(worldModel: WorldModelState): WorldModelState {
    return {
      entityGraph: {
        entities: new Map(worldModel.entityGraph.entities),
        relations: new Map(worldModel.entityGraph.relations),
        adjacency: new Map(worldModel.entityGraph.adjacency),
        reverseAdjacency: new Map(worldModel.entityGraph.reverseAdjacency),
      },
      timeline: {
        events: new Map(worldModel.timeline.events),
        causalLinks: [...worldModel.timeline.causalLinks],
        startTime: worldModel.timeline.startTime,
        endTime: worldModel.timeline.endTime,
        resolution: worldModel.timeline.resolution,
      },
      constraintMap: {
        constraints: new Map(worldModel.constraintMap.constraints),
        entityConstraints: new Map(worldModel.constraintMap.entityConstraints),
        violatedConstraints: [...worldModel.constraintMap.violatedConstraints],
      },
      goalStack: {
        goals: new Map(worldModel.goalStack.goals),
        activeGoals: [...worldModel.goalStack.activeGoals],
        completedGoals: [...worldModel.goalStack.completedGoals],
        failedGoals: [...worldModel.goalStack.failedGoals],
      },
      version: worldModel.version,
      checksum: worldModel.checksum,
    };
  }

  private calculateSynergy(
    personaIds: PersonaId[],
    registry: Map<string, { id: string; role: string; expertise: string[] }>
  ): number {
    if (personaIds.length < 2) return 0.3;

    const roles = new Set<string>();
    for (const id of personaIds) {
      const persona = registry.get(id as string);
      if (persona) roles.add(persona.role);
    }

    const roleDiversity = roles.size / personaIds.length;
    return Math.min(roleDiversity * 1.2, 1);
  }

  private calculateCoverage(
    personaIds: PersonaId[],
    registry: Map<string, { id: string; role: string; expertise: string[] }>,
    requiredExpertise: Set<string>
  ): number {
    if (requiredExpertise.size === 0) return 1;

    const coveredExpertise = new Set<string>();
    for (const id of personaIds) {
      const persona = registry.get(id as string);
      if (persona) {
        for (const exp of persona.expertise) {
          if (requiredExpertise.has(exp)) {
            coveredExpertise.add(exp);
          }
        }
      }
    }

    return coveredExpertise.size / requiredExpertise.size;
  }

  private calculateConflict(
    personaIds: PersonaId[],
    registry: Map<string, { id: string; role: string; expertise: string[] }>
  ): number {
    if (personaIds.length < 2) return 0;

    const conflictingRoles = new Set(["critic", "optimist"]);
    let conflictCount = 0;

    for (const id of personaIds) {
      const persona = registry.get(id as string);
      if (persona && conflictingRoles.has(persona.role)) {
        conflictCount++;
      }
    }

    return Math.min(conflictCount / personaIds.length, 1);
  }
}
