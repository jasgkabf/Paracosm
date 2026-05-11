import type { CSEContext, ConstructResult } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';

const logger = createLogger('ConstructPhase');

export class ConstructPhase {
  execute(context: CSEContext): Result<ConstructResult> {
    const startTime = Date.now();
    try {
      let entitiesCreated = 0;
      let relationsCreated = 0;
      let constraintsIdentified = 0;
      let goalsExtracted = 0;
      const queryParts = context.query.split(/[.!?;]+/).filter((s) => s.trim().length > 0);
      for (const part of queryParts) {
        entitiesCreated++;
        if (part.includes(' and ') || part.includes(' with ') || part.includes(' from ')) {
          relationsCreated++;
        }
        if (part.includes(' must ') || part.includes(' should ') || part.includes(' cannot ')) {
          constraintsIdentified++;
        }
        if (part.includes(' goal ') || part.includes(' achieve ') || part.includes(' accomplish ')) {
          goalsExtracted++;
        }
      }
      if (entitiesCreated === 0) entitiesCreated = 1;
      if (constraintsIdentified === 0) constraintsIdentified = 1;
      if (goalsExtracted === 0) goalsExtracted = 1;
      const result: ConstructResult = {
        phase: 'CONSTRUCT' as any,
        entitiesCreated,
        relationsCreated,
        constraintsIdentified,
        goalsExtracted,
        worldModelVersion: 1,
        duration: Date.now() - startTime,
        metadata: { sessionId: context.sessionId },
      };
      logger.info(`Construct phase complete: ${entitiesCreated} entities, ${relationsCreated} relations`);
      return ok(result);
    } catch (error) {
      return err(new Error(`Construct phase failed: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}
