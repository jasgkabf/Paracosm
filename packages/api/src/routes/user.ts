import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createLogger, generateId } from "@paracosm/shared";
import type { UserProfile, UserPreferences, UserConfig } from "@paracosm/shared";
import { WSManager } from "../websocket/ws-manager.js";
import { userSchema } from "../schemas/user-schema.js";

const logger = createLogger("api:routes:user");

const userProfiles = new Map<string, UserProfile>();
const userPreferences = new Map<string, UserPreferences>();
const userConfigs = new Map<string, UserConfig>();

function getDefaultProfile(userId: string): UserProfile {
  return {
    id: userId,
    username: `user_${userId.substring(0, 8)}`,
    displayName: "New User",
    email: "",
    avatarUrl: null,
    bio: null,
    role: "user",
    organization: null,
    locale: "en",
    timezone: "UTC",
    lastLoginAt: new Date().toISOString(),
    loginCount: 1,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getDefaultPreferences(): UserPreferences {
  return {
    theme: "system" as any,
    language: "en",
    fontSize: 14,
    compactMode: false,
    notifications: {
      level: "important" as any,
      email: true,
      push: true,
      inApp: true,
      sound: false,
      digestFrequency: "daily",
      quietHoursStart: null,
      quietHoursEnd: null,
    },
    accessibility: {
      reducedMotion: false,
      highContrast: false,
      screenReader: false,
      keyboardNavigation: false,
      fontSize: "medium",
    },
    editor: {
      tabSize: 2,
      insertSpaces: true,
      wordWrap: true,
      lineNumbers: true,
      minimap: false,
      autoSave: true,
      autoSaveDelayMs: 1000,
      formatOnSave: true,
    },
  };
}

function getDefaultConfig(userId: string): UserConfig {
  return {
    id: generateId(),
    userId: userId as any,
    preferences: getDefaultPreferences(),
    customShortcuts: {},
    layoutConfig: {},
    featureFlags: {},
    apiKeys: {},
    defaultModelId: null,
    defaultPersonaIds: [],
    maxConcurrentSimulations: 3,
    budgetLimitUsd: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function resolveUserId(request: FastifyRequest): string {
  return (request.user as Record<string, unknown>)?.id as string ?? "anonymous";
}

export async function registerUserRoutes(fastify: FastifyInstance, wsManager: WSManager): Promise<void> {
  fastify.get("/user/profile", {
    schema: userSchema.getProfile,
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = resolveUserId(request);

    let profile = userProfiles.get(userId);
    if (!profile) {
      profile = getDefaultProfile(userId);
      userProfiles.set(userId, profile);
    }

    return reply.status(200).send({
      success: true,
      data: profile,
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.put<{ Body: Partial<UserProfile> }>("/user/profile", {
    schema: userSchema.updateProfile,
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: Partial<UserProfile> }>, reply: FastifyReply) => {
    const userId = resolveUserId(request);
    const updates = request.body;

    if (!updates || typeof updates !== "object") {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Request body must be an object",
          details: {},
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const allowedFields = new Set([
      "username", "displayName", "email", "avatarUrl", "bio",
      "role", "organization", "locale", "timezone",
    ]);

    const disallowedFields = Object.keys(updates).filter((k) => !allowedFields.has(k));
    if (disallowedFields.length > 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: `Cannot update fields: ${disallowedFields.join(", ")}`,
          details: { disallowedFields },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    let profile = userProfiles.get(userId);
    if (!profile) {
      profile = getDefaultProfile(userId);
    }

    const updatedProfile: UserProfile = {
      ...profile,
      ...updates,
      id: profile.id,
      createdAt: profile.createdAt,
      updatedAt: new Date().toISOString(),
    };

    userProfiles.set(userId, updatedProfile);

    logger.info("User profile updated", { userId, fields: Object.keys(updates) });

    return reply.status(200).send({
      success: true,
      data: updatedProfile,
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.get("/user/preferences", {
    schema: userSchema.getPreferences,
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = resolveUserId(request);

    let prefs = userPreferences.get(userId);
    if (!prefs) {
      prefs = getDefaultPreferences();
      userPreferences.set(userId, prefs);
    }

    return reply.status(200).send({
      success: true,
      data: prefs,
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.put<{ Body: Partial<UserPreferences> }>("/user/preferences", {
    schema: userSchema.updatePreferences,
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: Partial<UserPreferences> }>, reply: FastifyReply) => {
    const userId = resolveUserId(request);
    const updates = request.body;

    if (!updates || typeof updates !== "object") {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Request body must be an object",
          details: {},
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    let prefs = userPreferences.get(userId);
    if (!prefs) {
      prefs = getDefaultPreferences();
    }

    const updatedPrefs: UserPreferences = {
      ...prefs,
      ...updates,
      notifications: updates.notifications
        ? { ...prefs.notifications, ...updates.notifications }
        : prefs.notifications,
      accessibility: updates.accessibility
        ? { ...prefs.accessibility, ...updates.accessibility }
        : prefs.accessibility,
      editor: updates.editor
        ? { ...prefs.editor, ...updates.editor }
        : prefs.editor,
    };

    userPreferences.set(userId, updatedPrefs);

    logger.info("User preferences updated", { userId, fields: Object.keys(updates) });

    return reply.status(200).send({
      success: true,
      data: updatedPrefs,
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
