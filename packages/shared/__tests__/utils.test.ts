import { describe, it } from "node:test";
import assert from "node:assert";
import { encrypt, decrypt, hash, keyDerivation, generateKey, generateSalt } from "../src/utils/crypto.js";
import { base64Encode, base64Decode, urlEncode, urlDecode, hexEncode, hexDecode } from "../src/utils/encoding.js";
import {
  isNonEmptyString,
  isPositiveNumber,
  isValidUrl,
  isValidPort,
  clamp,
} from "../src/utils/validation.js";
import {
  formatTokens,
  formatCost,
  formatDuration,
  formatBytes,
  formatBPM,
} from "../src/utils/formatting.js";
import { sleep, retry, withTimeout } from "../src/utils/async.js";
import { generateId, generateUUID, generateShortId } from "../src/utils/id.js";
import { safeParse, deepClone, merge, pick, omit } from "../src/utils/json.js";

describe("crypto", () => {
  it("encrypt and decrypt roundtrip with a valid key", () => {
    const key = generateKey();
    const plaintext = "hello world";
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);
    assert.strictEqual(decrypted, plaintext);
  });

  it("encrypt and decrypt roundtrip with empty string", () => {
    const key = generateKey();
    const plaintext = "";
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);
    assert.strictEqual(decrypted, plaintext);
  });

  it("encrypt and decrypt roundtrip with unicode content", () => {
    const key = generateKey();
    const plaintext = "unicode: \u00e9\u00e8\u00ea \u4f60\u597d \u3053\u3093\u306b\u3061\u306f";
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);
    assert.strictEqual(decrypted, plaintext);
  });

  it("encrypt and decrypt roundtrip with long content", () => {
    const key = generateKey();
    const plaintext = "x".repeat(10000);
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);
    assert.strictEqual(decrypted, plaintext);
  });

  it("encrypt produces different ciphertext each time due to random IV", () => {
    const key = generateKey();
    const plaintext = "same input";
    const encrypted1 = encrypt(plaintext, key);
    const encrypted2 = encrypt(plaintext, key);
    assert.notStrictEqual(encrypted1, encrypted2);
  });

  it("decrypt with wrong key throws an error", () => {
    const key1 = generateKey();
    const key2 = generateKey();
    const encrypted = encrypt("secret", key1);
    assert.throws(() => {
      decrypt(encrypted, key2);
    });
  });

  it("hash returns consistent output for the same input", () => {
    const input = "consistent hash input";
    const hash1 = hash(input);
    const hash2 = hash(input);
    assert.strictEqual(hash1, hash2);
  });

  it("hash returns different output for different inputs", () => {
    const hash1 = hash("input a");
    const hash2 = hash("input b");
    assert.notStrictEqual(hash1, hash2);
  });

  it("hash returns a 64-character hex string", () => {
    const result = hash("test");
    assert.strictEqual(result.length, 64);
    assert.ok(/^[0-9a-f]+$/.test(result));
  });

  it("keyDerivation returns consistent output for same password and salt", () => {
    const salt = generateSalt();
    const derived1 = keyDerivation("mypassword", salt);
    const derived2 = keyDerivation("mypassword", salt);
    assert.strictEqual(derived1, derived2);
  });

  it("keyDerivation returns different output for different passwords", () => {
    const salt = generateSalt();
    const derived1 = keyDerivation("password1", salt);
    const derived2 = keyDerivation("password2", salt);
    assert.notStrictEqual(derived1, derived2);
  });

  it("keyDerivation returns different output for different salts", () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const derived1 = keyDerivation("samepassword", salt1);
    const derived2 = keyDerivation("samepassword", salt2);
    assert.notStrictEqual(derived1, derived2);
  });

  it("generateKey returns a 64-character hex string", () => {
    const key = generateKey();
    assert.strictEqual(key.length, 64);
    assert.ok(/^[0-9a-f]+$/.test(key));
  });

  it("generateSalt returns a 64-character hex string", () => {
    const salt = generateSalt();
    assert.strictEqual(salt.length, 64);
    assert.ok(/^[0-9a-f]+$/.test(salt));
  });
});

describe("encoding", () => {
  it("base64Encode and base64Decode roundtrip", () => {
    const original = "hello world";
    const encoded = base64Encode(original);
    const decoded = base64Decode(encoded);
    assert.strictEqual(decoded, original);
  });

  it("base64Encode and base64Decode roundtrip with special characters", () => {
    const original = "special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?";
    const encoded = base64Encode(original);
    const decoded = base64Decode(encoded);
    assert.strictEqual(decoded, original);
  });

  it("base64Encode and base64Decode roundtrip with unicode", () => {
    const original = "\u4f60\u597d\u4e16\u754c";
    const encoded = base64Encode(original);
    const decoded = base64Decode(encoded);
    assert.strictEqual(decoded, original);
  });

  it("base64Encode produces valid base64 output", () => {
    const encoded = base64Encode("test");
    assert.ok(/^[A-Za-z0-9+/]+=*$/.test(encoded));
  });

  it("urlEncode and urlDecode roundtrip", () => {
    const original = "hello world & friends=true";
    const encoded = urlEncode(original);
    const decoded = urlDecode(encoded);
    assert.strictEqual(decoded, original);
  });

  it("urlEncode encodes special characters", () => {
    const encoded = urlEncode("a b c");
    assert.ok(!encoded.includes(" "));
  });

  it("urlEncode and urlDecode roundtrip with reserved characters", () => {
    const original = "path/to/resource?key=value&other=thing#fragment";
    const encoded = urlEncode(original);
    const decoded = urlDecode(encoded);
    assert.strictEqual(decoded, original);
  });

  it("hexEncode and hexDecode roundtrip", () => {
    const original = "hello world";
    const encoded = hexEncode(original);
    const decoded = hexDecode(encoded);
    assert.strictEqual(decoded, original);
  });

  it("hexEncode and hexDecode roundtrip with binary-like content", () => {
    const original = "\x00\x01\x02\xff";
    const encoded = hexEncode(original);
    const decoded = hexDecode(encoded);
    assert.strictEqual(decoded, original);
  });

  it("hexEncode produces valid hex output", () => {
    const encoded = hexEncode("AB");
    assert.ok(/^[0-9a-f]+$/.test(encoded));
  });
});

describe("validation", () => {
  it("isNonEmptyString returns true for non-empty strings", () => {
    assert.strictEqual(isNonEmptyString("hello"), true);
  });

  it("isNonEmptyString returns false for empty string", () => {
    assert.strictEqual(isNonEmptyString(""), false);
  });

  it("isNonEmptyString returns false for non-string types", () => {
    assert.strictEqual(isNonEmptyString(42), false);
    assert.strictEqual(isNonEmptyString(null), false);
    assert.strictEqual(isNonEmptyString(undefined), false);
    assert.strictEqual(isNonEmptyString(true), false);
    assert.strictEqual(isNonEmptyString({}), false);
  });

  it("isPositiveNumber returns true for positive numbers", () => {
    assert.strictEqual(isPositiveNumber(1), true);
    assert.strictEqual(isPositiveNumber(0.5), true);
    assert.strictEqual(isPositiveNumber(100), true);
  });

  it("isPositiveNumber returns false for zero", () => {
    assert.strictEqual(isPositiveNumber(0), false);
  });

  it("isPositiveNumber returns false for negative numbers", () => {
    assert.strictEqual(isPositiveNumber(-1), false);
    assert.strictEqual(isPositiveNumber(-0.5), false);
  });

  it("isPositiveNumber returns false for NaN and Infinity", () => {
    assert.strictEqual(isPositiveNumber(NaN), false);
    assert.strictEqual(isPositiveNumber(Infinity), false);
    assert.strictEqual(isPositiveNumber(-Infinity), false);
  });

  it("isPositiveNumber returns false for non-number types", () => {
    assert.strictEqual(isPositiveNumber("1"), false);
    assert.strictEqual(isPositiveNumber(null), false);
    assert.strictEqual(isPositiveNumber(undefined), false);
  });

  it("isValidUrl returns true for valid http URLs", () => {
    assert.strictEqual(isValidUrl("http://example.com"), true);
  });

  it("isValidUrl returns true for valid https URLs", () => {
    assert.strictEqual(isValidUrl("https://example.com/path?query=1"), true);
  });

  it("isValidUrl returns false for non-http/https protocols", () => {
    assert.strictEqual(isValidUrl("ftp://example.com"), false);
  });

  it("isValidUrl returns false for invalid URLs", () => {
    assert.strictEqual(isValidUrl("not-a-url"), false);
    assert.strictEqual(isValidUrl(""), false);
  });

  it("isValidUrl returns false for relative URLs", () => {
    assert.strictEqual(isValidUrl("/path/to/resource"), false);
  });

  it("isValidPort returns true for valid ports", () => {
    assert.strictEqual(isValidPort(1), true);
    assert.strictEqual(isValidPort(80), true);
    assert.strictEqual(isValidPort(443), true);
    assert.strictEqual(isValidPort(8080), true);
    assert.strictEqual(isValidPort(65535), true);
  });

  it("isValidPort returns false for out-of-range ports", () => {
    assert.strictEqual(isValidPort(0), false);
    assert.strictEqual(isValidPort(-1), false);
    assert.strictEqual(isValidPort(65536), false);
  });

  it("isValidPort returns false for non-integer numbers", () => {
    assert.strictEqual(isValidPort(80.5), false);
  });

  it("clamp constrains value within range", () => {
    assert.strictEqual(clamp(5, 0, 10), 5);
    assert.strictEqual(clamp(-5, 0, 10), 0);
    assert.strictEqual(clamp(15, 0, 10), 10);
  });

  it("clamp returns min when value equals min", () => {
    assert.strictEqual(clamp(0, 0, 10), 0);
  });

  it("clamp returns max when value equals max", () => {
    assert.strictEqual(clamp(10, 0, 10), 10);
  });

  it("clamp throws when min is greater than max", () => {
    assert.throws(() => {
      clamp(5, 10, 0);
    }, /min.*must be less than or equal to max/);
  });

  it("clamp works with negative ranges", () => {
    assert.strictEqual(clamp(-5, -10, -1), -5);
    assert.strictEqual(clamp(-15, -10, -1), -10);
    assert.strictEqual(clamp(0, -10, -1), -1);
  });
});

describe("formatting", () => {
  it("formatTokens formats small numbers as-is", () => {
    assert.strictEqual(formatTokens(42), "42");
    assert.strictEqual(formatTokens(0), "0");
    assert.strictEqual(formatTokens(999), "999");
  });

  it("formatTokens formats thousands with K suffix", () => {
    assert.strictEqual(formatTokens(1000), "1.0K");
    assert.strictEqual(formatTokens(1500), "1.5K");
  });

  it("formatTokens formats millions with M suffix", () => {
    assert.strictEqual(formatTokens(1000000), "1.0M");
    assert.strictEqual(formatTokens(2500000), "2.5M");
  });

  it("formatTokens formats billions with B suffix", () => {
    assert.strictEqual(formatTokens(1000000000), "1.0B");
  });

  it("formatTokens handles negative and NaN values", () => {
    assert.strictEqual(formatTokens(-1), "0");
    assert.strictEqual(formatTokens(NaN), "0");
    assert.strictEqual(formatTokens(Infinity), "0");
  });

  it("formatCost formats zero cost", () => {
    assert.strictEqual(formatCost(0), "$0.00");
  });

  it("formatCost formats small costs with more decimals", () => {
    assert.strictEqual(formatCost(0.0001), "$0.000100");
  });

  it("formatCost formats moderate costs", () => {
    assert.strictEqual(formatCost(0.5), "$0.500");
  });

  it("formatCost formats dollar-range costs", () => {
    assert.strictEqual(formatCost(10), "$10.00");
  });

  it("formatCost handles negative and NaN values", () => {
    assert.strictEqual(formatCost(-1), "$0.00");
    assert.strictEqual(formatCost(NaN), "$0.00");
  });

  it("formatDuration formats milliseconds", () => {
    assert.strictEqual(formatDuration(500), "500ms");
  });

  it("formatDuration formats sub-millisecond values", () => {
    assert.strictEqual(formatDuration(0.5), "0.50ms");
  });

  it("formatDuration formats seconds", () => {
    assert.strictEqual(formatDuration(1500), "1.5s");
  });

  it("formatDuration formats minutes and seconds", () => {
    assert.strictEqual(formatDuration(90000), "1m 30s");
  });

  it("formatDuration formats hours and minutes", () => {
    assert.strictEqual(formatDuration(3660000), "1h 1m");
  });

  it("formatDuration handles negative and NaN values", () => {
    assert.strictEqual(formatDuration(-1), "0ms");
    assert.strictEqual(formatDuration(NaN), "0ms");
  });

  it("formatBytes formats bytes", () => {
    assert.strictEqual(formatBytes(0), "0 B");
    assert.strictEqual(formatBytes(100), "100 B");
  });

  it("formatBytes formats kilobytes", () => {
    assert.strictEqual(formatBytes(1024), "1.0 KB");
  });

  it("formatBytes formats megabytes", () => {
    assert.strictEqual(formatBytes(1048576), "1.0 MB");
  });

  it("formatBytes formats gigabytes", () => {
    assert.strictEqual(formatBytes(1073741824), "1.00 GB");
  });

  it("formatBytes handles negative and NaN values", () => {
    assert.strictEqual(formatBytes(-1), "0 B");
    assert.strictEqual(formatBytes(NaN), "0 B");
  });

  it("formatBPM formats normal BPM", () => {
    assert.strictEqual(formatBPM(72), "72 BPM");
    assert.strictEqual(formatBPM(120), "120 BPM");
  });

  it("formatBPM rounds BPM values", () => {
    assert.strictEqual(formatBPM(72.7), "73 BPM");
  });

  it("formatBPM handles negative and NaN values", () => {
    assert.strictEqual(formatBPM(-1), "0 BPM");
    assert.strictEqual(formatBPM(NaN), "0 BPM");
  });
});

describe("async", () => {
  it("sleep resolves after the specified duration", async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 40, `Expected at least 40ms, got ${elapsed}ms`);
  });

  it("sleep with zero duration resolves immediately", async () => {
    const start = Date.now();
    await sleep(0);
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 50, `Expected less than 50ms, got ${elapsed}ms`);
  });

  it("sleep throws for negative duration", () => {
    assert.throws(() => sleep(-1), /non-negative/);
  });

  it("sleep throws for NaN duration", () => {
    assert.throws(() => sleep(NaN), /non-negative/);
  });

  it("retry succeeds on first attempt", async () => {
    let attempts = 0;
    const result = await retry(async () => {
      attempts++;
      return "success";
    }, { maxAttempts: 3, delayMs: 10 });
    assert.strictEqual(result, "success");
    assert.strictEqual(attempts, 1);
  });

  it("retry succeeds after transient failures", async () => {
    let attempts = 0;
    const result = await retry(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error("transient");
      }
      return "recovered";
    }, { maxAttempts: 3, delayMs: 10 });
    assert.strictEqual(result, "recovered");
    assert.strictEqual(attempts, 3);
  });

  it("retry throws after exhausting max attempts", async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        retry(
          async () => {
            attempts++;
            throw new Error("persistent");
          },
          { maxAttempts: 2, delayMs: 10 }
        ),
      /persistent/
    );
    assert.strictEqual(attempts, 2);
  });

  it("retry respects shouldRetry callback", async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        retry(
          async () => {
            attempts++;
            throw new Error("non-retryable");
          },
          { maxAttempts: 3, delayMs: 10, shouldRetry: () => false }
        ),
      /non-retryable/
    );
    assert.strictEqual(attempts, 1);
  });

  it("withTimeout resolves when promise completes in time", async () => {
    const result = await withTimeout(
      new Promise<string>((resolve) => setTimeout(() => resolve("done"), 10)),
      1000
    );
    assert.strictEqual(result, "done");
  });

  it("withTimeout rejects when promise exceeds timeout", async () => {
    await assert.rejects(
      () =>
        withTimeout(
          new Promise<string>((resolve) => setTimeout(() => resolve("late"), 500)),
          10
        ),
      /timed out/
    );
  });

  it("withTimeout resolves for instant promises", async () => {
    const result = await withTimeout(Promise.resolve("instant"), 1000);
    assert.strictEqual(result, "instant");
  });
});

describe("id", () => {
  it("generateId returns a string", () => {
    const id = generateId();
    assert.strictEqual(typeof id, "string");
  });

  it("generateId returns unique values", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    assert.strictEqual(ids.size, 100);
  });

  it("generateId returns a string of expected length", () => {
    const id = generateId();
    assert.strictEqual(id.length, 21);
  });

  it("generateId uses only the expected alphabet", () => {
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const alphabetSet = new Set(alphabet.split(""));
    for (let i = 0; i < 10; i++) {
      const id = generateId();
      for (const char of id) {
        assert.ok(alphabetSet.has(char), `Unexpected character: ${char}`);
      }
    }
  });

  it("generateUUID returns a valid UUID format", () => {
    const uuid = generateUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    assert.ok(uuidRegex.test(uuid), `UUID "${uuid}" does not match expected format`);
  });

  it("generateUUID returns unique values", () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }
    assert.strictEqual(uuids.size, 100);
  });

  it("generateShortId returns a string of length 8", () => {
    const id = generateShortId();
    assert.strictEqual(id.length, 8);
  });

  it("generateShortId returns unique values", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateShortId());
    }
    assert.strictEqual(ids.size, 100);
  });

  it("generateShortId uses only the expected alphabet", () => {
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const alphabetSet = new Set(alphabet.split(""));
    for (let i = 0; i < 10; i++) {
      const id = generateShortId();
      for (const char of id) {
        assert.ok(alphabetSet.has(char), `Unexpected character: ${char}`);
      }
    }
  });
});

describe("json", () => {
  it("safeParse returns ok for valid JSON", () => {
    const result = safeParse('{"name":"test","value":42}');
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual((result.value as Record<string, unknown>).name, "test");
      assert.strictEqual((result.value as Record<string, unknown>).value, 42);
    }
  });

  it("safeParse returns err for invalid JSON", () => {
    const result = safeParse("not valid json{{{");
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.ok(result.error.includes("JSON parse error"));
    }
  });

  it("safeParse returns ok for JSON arrays", () => {
    const result = safeParse("[1,2,3]");
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.deepStrictEqual(result.value, [1, 2, 3]);
    }
  });

  it("safeParse returns ok for JSON primitives", () => {
    const numResult = safeParse("42");
    assert.strictEqual(numResult.ok, true);
    if (numResult.ok) {
      assert.strictEqual(numResult.value, 42);
    }

    const strResult = safeParse('"hello"');
    assert.strictEqual(strResult.ok, true);
    if (strResult.ok) {
      assert.strictEqual(strResult.value, "hello");
    }

    const nullResult = safeParse("null");
    assert.strictEqual(nullResult.ok, true);
    if (nullResult.ok) {
      assert.strictEqual(nullResult.value, null);
    }
  });

  it("deepClone creates an independent copy", () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = deepClone(original);
    assert.deepStrictEqual(cloned, original);
    (cloned as Record<string, unknown>).b = "modified";
    assert.deepStrictEqual(original.b, { c: 2 });
  });

  it("deepClone handles arrays", () => {
    const original = [1, [2, 3], { a: 4 }];
    const cloned = deepClone(original);
    assert.deepStrictEqual(cloned, original);
    cloned[1] = [9, 9];
    assert.deepStrictEqual(original[1], [2, 3]);
  });

  it("deepClone handles null and primitives", () => {
    assert.strictEqual(deepClone(null), null);
    assert.strictEqual(deepClone(42), 42);
    assert.strictEqual(deepClone("hello"), "hello");
    assert.strictEqual(deepClone(true), true);
  });

  it("merge combines target and source objects", () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    const result = merge(target, source);
    assert.deepStrictEqual(result, { a: 1, b: 3, c: 4 });
  });

  it("merge does not modify the original target", () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3 };
    merge(target, source);
    assert.deepStrictEqual(target, { a: 1, b: 2 });
  });

  it("merge overwrites target values with source values", () => {
    const target = { x: "old" };
    const source = { x: "new" };
    const result = merge(target, source);
    assert.strictEqual(result.x, "new");
  });

  it("pick extracts specified keys from an object", () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const result = pick(obj, ["a", "c"]);
    assert.deepStrictEqual(result, { a: 1, c: 3 });
  });

  it("pick ignores keys that do not exist in the object", () => {
    const obj = { a: 1, b: 2 };
    const result = pick(obj, ["a", "z"] as ("a" | "z")[]);
    assert.deepStrictEqual(result, { a: 1 });
  });

  it("pick returns empty object when no keys specified", () => {
    const obj = { a: 1, b: 2 };
    const result = pick(obj, []);
    assert.deepStrictEqual(result, {});
  });

  it("omit removes specified keys from an object", () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const result = omit(obj, ["b", "d"]);
    assert.deepStrictEqual(result, { a: 1, c: 3 });
  });

  it("omit returns the full object when no keys specified", () => {
    const obj = { a: 1, b: 2 };
    const result = omit(obj, []);
    assert.deepStrictEqual(result, { a: 1, b: 2 });
  });

  it("omit handles keys that do not exist in the object", () => {
    const obj = { a: 1, b: 2 };
    const result = omit(obj, ["z"] as ("z")[]);
    assert.deepStrictEqual(result, { a: 1, b: 2 });
  });
});
