import { describe, it } from "node:test";
import assert from "node:assert";
import { DEFAULT_PORT, APP_NAME, APP_VERSION, WEBSOCKET_PATH, API_PREFIX } from "../src/constants/app.js";
import {
  PROVIDER_OPENAI,
  PROVIDER_ANTHROPIC,
  PROVIDER_GOOGLE,
  PROVIDER_DEEPSEEK,
  PROVIDER_MOONSHOT,
  PROVIDER_OLLAMA,
  PROVIDER_LMSTUDIO,
  PROVIDER_VLLM,
  PROVIDER_CUSTOM,
} from "../src/constants/llm-providers.js";
import { MODEL_CAPABILITIES } from "../src/constants/models.js";
import type { ModelId } from "../src/constants/models.js";
import {
  DEFAULT_BPM,
  ANOMALY_THRESHOLDS,
  MIN_BPM,
  MAX_BPM,
  HEART_PHASE_IDLE,
  HEART_PHASE_FLATLINE,
} from "../src/constants/heartbeat.js";

describe("app constants", () => {
  it("DEFAULT_PORT is 7529", () => {
    assert.strictEqual(DEFAULT_PORT, 7529);
  });

  it("APP_NAME is Paracosm", () => {
    assert.strictEqual(APP_NAME, "Paracosm");
  });

  it("APP_VERSION is a valid semver string", () => {
    assert.ok(/^\d+\.\d+\.\d+$/.test(APP_VERSION), `${APP_VERSION} is not a valid semver`);
  });

  it("WEBSOCKET_PATH starts with a slash", () => {
    assert.ok(WEBSOCKET_PATH.startsWith("/"));
  });

  it("API_PREFIX starts with a slash", () => {
    assert.ok(API_PREFIX.startsWith("/"));
  });
});

describe("provider IDs", () => {
  it("PROVIDER_OPENAI is defined", () => {
    assert.strictEqual(PROVIDER_OPENAI, "openai");
  });

  it("PROVIDER_ANTHROPIC is defined", () => {
    assert.strictEqual(PROVIDER_ANTHROPIC, "anthropic");
  });

  it("PROVIDER_GOOGLE is defined", () => {
    assert.strictEqual(PROVIDER_GOOGLE, "google");
  });

  it("PROVIDER_DEEPSEEK is defined", () => {
    assert.strictEqual(PROVIDER_DEEPSEEK, "deepseek");
  });

  it("PROVIDER_MOONSHOT is defined", () => {
    assert.strictEqual(PROVIDER_MOONSHOT, "moonshot");
  });

  it("PROVIDER_OLLAMA is defined", () => {
    assert.strictEqual(PROVIDER_OLLAMA, "ollama");
  });

  it("PROVIDER_LMSTUDIO is defined", () => {
    assert.strictEqual(PROVIDER_LMSTUDIO, "lmstudio");
  });

  it("PROVIDER_VLLM is defined", () => {
    assert.strictEqual(PROVIDER_VLLM, "vllm");
  });

  it("PROVIDER_CUSTOM is defined", () => {
    assert.strictEqual(PROVIDER_CUSTOM, "custom");
  });

  it("all provider IDs are unique strings", () => {
    const ids = [
      PROVIDER_OPENAI,
      PROVIDER_ANTHROPIC,
      PROVIDER_GOOGLE,
      PROVIDER_DEEPSEEK,
      PROVIDER_MOONSHOT,
      PROVIDER_OLLAMA,
      PROVIDER_LMSTUDIO,
      PROVIDER_VLLM,
      PROVIDER_CUSTOM,
    ];
    const uniqueIds = new Set(ids);
    assert.strictEqual(uniqueIds.size, ids.length, "Provider IDs must be unique");
  });
});

describe("MODEL_CAPABILITIES", () => {
  const modelIds = Object.keys(MODEL_CAPABILITIES) as ModelId[];

  it("has at least one model defined", () => {
    assert.ok(modelIds.length > 0);
  });

  it("each model has contextWindow field", () => {
    for (const id of modelIds) {
      assert.ok(
        typeof MODEL_CAPABILITIES[id].contextWindow === "number",
        `Model ${id} missing contextWindow`
      );
    }
  });

  it("each model has supportsStreaming field", () => {
    for (const id of modelIds) {
      assert.ok(
        typeof MODEL_CAPABILITIES[id].supportsStreaming === "boolean",
        `Model ${id} missing supportsStreaming`
      );
    }
  });

  it("each model has supportsFunctionCalling field", () => {
    for (const id of modelIds) {
      assert.ok(
        typeof MODEL_CAPABILITIES[id].supportsFunctionCalling === "boolean",
        `Model ${id} missing supportsFunctionCalling`
      );
    }
  });

  it("each model has supportsVision field", () => {
    for (const id of modelIds) {
      assert.ok(
        typeof MODEL_CAPABILITIES[id].supportsVision === "boolean",
        `Model ${id} missing supportsVision`
      );
    }
  });

  it("each model has maxOutputTokens field", () => {
    for (const id of modelIds) {
      assert.ok(
        typeof MODEL_CAPABILITIES[id].maxOutputTokens === "number",
        `Model ${id} missing maxOutputTokens`
      );
    }
  });

  it("each model has a positive contextWindow", () => {
    for (const id of modelIds) {
      assert.ok(
        MODEL_CAPABILITIES[id].contextWindow > 0,
        `Model ${id} has non-positive contextWindow`
      );
    }
  });

  it("each model has a positive maxOutputTokens", () => {
    for (const id of modelIds) {
      assert.ok(
        MODEL_CAPABILITIES[id].maxOutputTokens > 0,
        `Model ${id} has non-positive maxOutputTokens`
      );
    }
  });
});

describe("DEFAULT_BPM", () => {
  const phases = Object.keys(DEFAULT_BPM);

  it("has BPM values for all heart phases", () => {
    assert.ok(phases.length > 0);
  });

  it("all BPM values are numbers", () => {
    for (const phase of phases) {
      assert.strictEqual(typeof DEFAULT_BPM[phase as keyof typeof DEFAULT_BPM], "number");
    }
  });

  it("all BPM values are within valid range (MIN_BPM to MAX_BPM)", () => {
    for (const phase of phases) {
      const bpm = DEFAULT_BPM[phase as keyof typeof DEFAULT_BPM];
      assert.ok(
        bpm >= MIN_BPM && bpm <= MAX_BPM,
        `BPM for ${phase} is ${bpm}, outside range [${MIN_BPM}, ${MAX_BPM}]`
      );
    }
  });

  it("flatline phase has zero BPM", () => {
    assert.strictEqual(DEFAULT_BPM[HEART_PHASE_FLATLINE], 0);
  });

  it("idle phase has a low BPM", () => {
    assert.ok(DEFAULT_BPM[HEART_PHASE_IDLE] < 100, "Idle BPM should be less than 100");
  });

  it("critical phase has a high BPM", () => {
    assert.ok(DEFAULT_BPM.critical > 100, "Critical BPM should be greater than 100");
  });
});

describe("ANOMALY_THRESHOLDS", () => {
  it("has tachycardiaBPM defined", () => {
    assert.ok(typeof ANOMALY_THRESHOLDS.tachycardiaBPM === "number");
  });

  it("has bradycardiaBPM defined", () => {
    assert.ok(typeof ANOMALY_THRESHOLDS.bradycardiaBPM === "number");
  });

  it("has maxVariability defined", () => {
    assert.ok(typeof ANOMALY_THRESHOLDS.maxVariability === "number");
  });

  it("has flatlineTimeoutMs defined", () => {
    assert.ok(typeof ANOMALY_THRESHOLDS.flatlineTimeoutMs === "number");
  });

  it("tachycardiaBPM is greater than bradycardiaBPM", () => {
    assert.ok(
      ANOMALY_THRESHOLDS.tachycardiaBPM > ANOMALY_THRESHOLDS.bradycardiaBPM,
      "Tachycardia threshold should be higher than bradycardia threshold"
    );
  });

  it("tachycardiaBPM is a reasonable value (above normal resting)", () => {
    assert.ok(ANOMALY_THRESHOLDS.tachycardiaBPM >= 100, "Tachycardia should be at least 100 BPM");
  });

  it("bradycardiaBPM is a reasonable value (below normal resting)", () => {
    assert.ok(ANOMALY_THRESHOLDS.bradycardiaBPM <= 60, "Bradycardia should be at most 60 BPM");
  });

  it("maxVariability is a positive number", () => {
    assert.ok(ANOMALY_THRESHOLDS.maxVariability > 0, "Max variability should be positive");
  });

  it("flatlineTimeoutMs is a positive number", () => {
    assert.ok(ANOMALY_THRESHOLDS.flatlineTimeoutMs > 0, "Flatline timeout should be positive");
  });

  it("flatlineTimeoutMs is a reasonable duration (at least 1 second)", () => {
    assert.ok(
      ANOMALY_THRESHOLDS.flatlineTimeoutMs >= 1000,
      "Flatline timeout should be at least 1000ms"
    );
  });
});
