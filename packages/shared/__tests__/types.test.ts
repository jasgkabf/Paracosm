import { describe, it } from "node:test";
import assert from "node:assert";
import {
  ok,
  err,
  isOk,
  isErr,
  some,
  none,
  isSome,
  isNone,
  SortOrder,
  type Result,
  type Option,
  type Pagination,
  type Timestamped,
  type Identified,
  type DeepPartial,
  type DeepReadonly,
  type Nullable,
  type Optional,
  type Duration,
  type RateLimit,
} from "../src/types/common.js";
import { CSEPhase, CSEStatus } from "../src/types/orchestrator.js";
import { HeartPhase, RhythmType, AnomalyType, HeartbeatEventType } from "../src/types/heartbeat.js";
import { SimulationStatus } from "../src/types/simulation.js";
import { EntityType, RelationType, GoalState, GoalPriority } from "../src/types/world-model.js";

describe("common types module exports", () => {
  it("exports Result type helpers", () => {
    assert.strictEqual(typeof ok, "function");
    assert.strictEqual(typeof err, "function");
    assert.strictEqual(typeof isOk, "function");
    assert.strictEqual(typeof isErr, "function");
  });

  it("exports Option type helpers", () => {
    assert.strictEqual(typeof some, "function");
    assert.strictEqual(typeof none, "function");
    assert.strictEqual(typeof isSome, "function");
    assert.strictEqual(typeof isNone, "function");
  });

  it("exports SortOrder enum", () => {
    assert.strictEqual(SortOrder.Ascending, "ascending");
    assert.strictEqual(SortOrder.Descending, "descending");
  });
});

describe("Result type helpers", () => {
  it("ok() returns a successful Result with the given value", () => {
    const result = ok(42);
    assert.deepStrictEqual(result, { ok: true, value: 42 });
  });

  it("ok() works with string values", () => {
    const result = ok("hello");
    assert.deepStrictEqual(result, { ok: true, value: "hello" });
  });

  it("ok() works with object values", () => {
    const obj = { name: "test", count: 5 };
    const result = ok(obj);
    assert.deepStrictEqual(result, { ok: true, value: obj });
  });

  it("ok() works with null value", () => {
    const result = ok(null);
    assert.deepStrictEqual(result, { ok: true, value: null });
  });

  it("ok() works with undefined value", () => {
    const result = ok(undefined);
    assert.deepStrictEqual(result, { ok: true, value: undefined });
  });

  it("err() returns a failed Result with the given error", () => {
    const result = err(new Error("something failed"));
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.ok(result.error instanceof Error);
      assert.strictEqual(result.error.message, "something failed");
    }
  });

  it("err() works with string error type", () => {
    const result = err<string, string>("failure");
    assert.deepStrictEqual(result, { ok: false, error: "failure" });
  });

  it("err() works with number error type", () => {
    const result = err<string, number>(404);
    assert.deepStrictEqual(result, { ok: false, error: 404 });
  });

  it("isOk() returns true for ok results", () => {
    const result = ok(10);
    assert.strictEqual(isOk(result), true);
  });

  it("isOk() returns false for err results", () => {
    const result = err("bad");
    assert.strictEqual(isOk(result), false);
  });

  it("isErr() returns true for err results", () => {
    const result = err("bad");
    assert.strictEqual(isErr(result), true);
  });

  it("isErr() returns false for ok results", () => {
    const result = ok(10);
    assert.strictEqual(isErr(result), false);
  });

  it("isOk() narrows the type to access value", () => {
    const result: Result<number, string> = ok(99);
    if (isOk(result)) {
      assert.strictEqual(result.value, 99);
    } else {
      assert.fail("Should have been ok");
    }
  });

  it("isErr() narrows the type to access error", () => {
    const result: Result<number, string> = err("oops");
    if (isErr(result)) {
      assert.strictEqual(result.error, "oops");
    } else {
      assert.fail("Should have been err");
    }
  });
});

describe("Option type helpers", () => {
  it("some() returns an Option with the given value", () => {
    const option = some(42);
    assert.deepStrictEqual(option, { some: true, value: 42 });
  });

  it("some() works with string values", () => {
    const option = some("world");
    assert.deepStrictEqual(option, { some: true, value: "world" });
  });

  it("some() works with object values", () => {
    const obj = { id: 1, name: "test" };
    const option = some(obj);
    assert.deepStrictEqual(option, { some: true, value: obj });
  });

  it("none() returns an Option with no value", () => {
    const option = none();
    assert.deepStrictEqual(option, { some: false });
  });

  it("none() does not have a value property", () => {
    const option = none<number>();
    assert.strictEqual("value" in option, false);
  });

  it("isSome() returns true for some options", () => {
    const option = some(10);
    assert.strictEqual(isSome(option), true);
  });

  it("isSome() returns false for none options", () => {
    const option = none();
    assert.strictEqual(isSome(option), false);
  });

  it("isNone() returns true for none options", () => {
    const option = none();
    assert.strictEqual(isNone(option), true);
  });

  it("isNone() returns false for some options", () => {
    const option = some(10);
    assert.strictEqual(isNone(option), false);
  });

  it("isSome() narrows the type to access value", () => {
    const option: Option<number> = some(77);
    if (isSome(option)) {
      assert.strictEqual(option.value, 77);
    } else {
      assert.fail("Should have been some");
    }
  });

  it("isNone() narrows the type correctly", () => {
    const option: Option<number> = none();
    if (isNone(option)) {
      assert.strictEqual(option.some, false);
    } else {
      assert.fail("Should have been none");
    }
  });
});

describe("CSEPhase enum", () => {
  it("has Construct phase", () => {
    assert.strictEqual(CSEPhase.Construct, "CONSTRUCT");
  });

  it("has Simulate phase", () => {
    assert.strictEqual(CSEPhase.Simulate, "SIMULATE");
  });

  it("has Execute phase", () => {
    assert.strictEqual(CSEPhase.Execute, "EXECUTE");
  });

  it("has Reflect phase", () => {
    assert.strictEqual(CSEPhase.Reflect, "REFLECT");
  });

  it("has Evolve phase", () => {
    assert.strictEqual(CSEPhase.Evolve, "EVOLVE");
  });

  it("has exactly 5 phases", () => {
    const phases = Object.values(CSEPhase);
    assert.strictEqual(phases.length, 5);
  });

  it("all phase values are uppercase strings", () => {
    const phases = Object.values(CSEPhase);
    for (const phase of phases) {
      assert.strictEqual(phase, phase.toUpperCase());
      assert.ok(/^[A-Z]+$/.test(phase), `Phase "${phase}" should be uppercase`);
    }
  });
});

describe("HeartPhase enum", () => {
  it("has Systole phase", () => {
    assert.strictEqual(HeartPhase.Systole, "systole");
  });

  it("has Diastole phase", () => {
    assert.strictEqual(HeartPhase.Diastole, "diastole");
  });

  it("has Rest phase", () => {
    assert.strictEqual(HeartPhase.Rest, "rest");
  });

  it("has exactly 3 phases", () => {
    const phases = Object.values(HeartPhase);
    assert.strictEqual(phases.length, 3);
  });

  it("all phase values are lowercase strings", () => {
    const phases = Object.values(HeartPhase);
    for (const phase of phases) {
      assert.strictEqual(phase, phase.toLowerCase());
    }
  });
});

describe("related enums", () => {
  it("CSEStatus has expected values", () => {
    assert.strictEqual(CSEStatus.Initialized, "initialized");
    assert.strictEqual(CSEStatus.Running, "running");
    assert.strictEqual(CSEStatus.Paused, "paused");
    assert.strictEqual(CSEStatus.Completed, "completed");
    assert.strictEqual(CSEStatus.Failed, "failed");
    assert.strictEqual(CSEStatus.Cancelled, "cancelled");
  });

  it("RhythmType has expected values", () => {
    assert.strictEqual(RhythmType.Normal, "normal");
    assert.strictEqual(RhythmType.Accelerated, "accelerated");
    assert.strictEqual(RhythmType.Decelerated, "decelerated");
    assert.strictEqual(RhythmType.Irregular, "irregular");
    assert.strictEqual(RhythmType.Flatline, "flatline");
  });

  it("SimulationStatus has expected values", () => {
    assert.strictEqual(SimulationStatus.Queued, "queued");
    assert.strictEqual(SimulationStatus.Running, "running");
    assert.strictEqual(SimulationStatus.Paused, "paused");
    assert.strictEqual(SimulationStatus.Completed, "completed");
    assert.strictEqual(SimulationStatus.Failed, "failed");
    assert.strictEqual(SimulationStatus.Cancelled, "cancelled");
  });

  it("EntityType has expected values", () => {
    assert.strictEqual(EntityType.Agent, "agent");
    assert.strictEqual(EntityType.Resource, "resource");
    assert.strictEqual(EntityType.Location, "location");
    assert.strictEqual(EntityType.Event, "event");
    assert.strictEqual(EntityType.Concept, "concept");
    assert.strictEqual(EntityType.Organization, "organization");
    assert.strictEqual(EntityType.Artifact, "artifact");
    assert.strictEqual(EntityType.Process, "process");
  });

  it("AnomalyType has expected values", () => {
    assert.strictEqual(AnomalyType.Spike, "spike");
    assert.strictEqual(AnomalyType.Drop, "drop");
    assert.strictEqual(AnomalyType.Trend, "trend");
    assert.strictEqual(AnomalyType.Oscillation, "oscillation");
    assert.strictEqual(AnomalyType.Stagnation, "stagnation");
    assert.strictEqual(AnomalyType.Outlier, "outlier");
  });

  it("HeartbeatEventType has expected values", () => {
    assert.strictEqual(HeartbeatEventType.Beat, "beat");
    assert.strictEqual(HeartbeatEventType.Arrhythmia, "arrhythmia");
    assert.strictEqual(HeartbeatEventType.Stress, "stress");
    assert.strictEqual(HeartbeatEventType.Recovery, "recovery");
    assert.strictEqual(HeartbeatEventType.Alert, "alert");
    assert.strictEqual(HeartbeatEventType.Threshold, "threshold");
  });

  it("GoalState has expected values", () => {
    assert.strictEqual(GoalState.Pending, "pending");
    assert.strictEqual(GoalState.Active, "active");
    assert.strictEqual(GoalState.InProgress, "in_progress");
    assert.strictEqual(GoalState.Completed, "completed");
    assert.strictEqual(GoalState.Failed, "failed");
  });

  it("GoalPriority has expected numeric values", () => {
    assert.strictEqual(GoalPriority.Critical, 0);
    assert.strictEqual(GoalPriority.High, 1);
    assert.strictEqual(GoalPriority.Medium, 2);
    assert.strictEqual(GoalPriority.Low, 3);
    assert.strictEqual(GoalPriority.Optional, 4);
  });

  it("RelationType has expected values", () => {
    assert.strictEqual(RelationType.DependsOn, "depends_on");
    assert.strictEqual(RelationType.Influences, "influences");
    assert.strictEqual(RelationType.Contains, "contains");
  });
});
