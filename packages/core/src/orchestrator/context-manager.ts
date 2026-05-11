import type { CSEContext } from '@paracosm/shared';
import { generateId, ok, err, type Result, createLogger } from '@paracosm/shared';

const logger = createLogger('ContextManager');

export class ContextManager {
  private contexts: Map<string, CSEContext> = new Map();
  private activeContextId: string | null = null;

  createContext(data: { userId: string; query: string; activePersonas?: string[]; availableTools?: string[]; budgetRemaining?: number; tokenBudget?: number; metadata?: Record<string, unknown> }): CSEContext {
    const context: CSEContext = {
      sessionId: generateId(),
      userId: data.userId,
      query: data.query,
      activePersonas: data.activePersonas ?? [],
      availableTools: data.availableTools ?? [],
      budgetRemaining: data.budgetRemaining ?? data.tokenBudget ?? 100000,
      tokenBudget: data.tokenBudget ?? 100000,
      tokensUsed: 0,
      metadata: data.metadata ?? {},
      createdAt: new Date(),
    };
    this.contexts.set(context.sessionId, context);
    this.activeContextId = context.sessionId;
    logger.info(`Created context: ${context.sessionId}`);
    return context;
  }

  getContext(sessionId: string): CSEContext | undefined {
    return this.contexts.get(sessionId);
  }

  getActiveContext(): CSEContext | undefined {
    if (!this.activeContextId) return undefined;
    return this.contexts.get(this.activeContextId);
  }

  setActiveContext(sessionId: string): Result<boolean> {
    if (!this.contexts.has(sessionId)) {
      return err(new Error(`Context ${sessionId} not found`));
    }
    this.activeContextId = sessionId;
    return ok(true);
  }

  updateContext(sessionId: string, updates: Partial<CSEContext>): Result<CSEContext> {
    const context = this.contexts.get(sessionId);
    if (!context) {
      return err(new Error(`Context ${sessionId} not found`));
    }
    const updated: CSEContext = { ...context, ...updates, sessionId: context.sessionId, createdAt: context.createdAt };
    this.contexts.set(sessionId, updated);
    return ok(updated);
  }

  consumeTokens(sessionId: string, count: number): Result<number> {
    const context = this.contexts.get(sessionId);
    if (!context) {
      return err(new Error(`Context ${sessionId} not found`));
    }
    context.tokensUsed += count;
    context.budgetRemaining -= count;
    return ok(context.budgetRemaining);
  }

  isBudgetExceeded(sessionId: string): boolean {
    const context = this.contexts.get(sessionId);
    if (!context) return true;
    return context.budgetRemaining <= 0;
  }

  getAllContexts(): CSEContext[] {
    return Array.from(this.contexts.values());
  }

  clear(): void {
    this.contexts.clear();
    this.activeContextId = null;
  }
}
