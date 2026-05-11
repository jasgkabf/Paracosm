export const userSchema = {
  getProfile: {
    response: {
      200: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const },
          data: {
            type: "object" as const,
            properties: {
              id: { type: "string" as const },
              username: { type: "string" as const },
              displayName: { type: "string" as const },
              email: { type: "string" as const },
              role: { type: "string" as const },
              locale: { type: "string" as const },
              timezone: { type: "string" as const },
              active: { type: "boolean" as const },
              createdAt: { type: "string" as const },
              updatedAt: { type: "string" as const },
            },
          },
        },
      },
    },
  },

  updateProfile: {
    body: {
      type: "object" as const,
      properties: {
        username: { type: "string" as const, minLength: 3, maxLength: 50 },
        displayName: { type: "string" as const, minLength: 1, maxLength: 100 },
        email: { type: "string" as const, format: "email" },
        avatarUrl: { type: "string" as const, format: "uri" },
        bio: { type: "string" as const, maxLength: 500 },
        role: { type: "string" as const },
        organization: { type: "string" as const, maxLength: 100 },
        locale: { type: "string" as const, minLength: 2, maxLength: 10 },
        timezone: { type: "string" as const, maxLength: 50 },
      },
    },
  },

  getPreferences: {
    response: {
      200: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const },
          data: {
            type: "object" as const,
            properties: {
              theme: { type: "string" as const },
              language: { type: "string" as const },
              fontSize: { type: "number" as const },
              compactMode: { type: "boolean" as const },
              notifications: { type: "object" as const },
              accessibility: { type: "object" as const },
              editor: { type: "object" as const },
            },
          },
        },
      },
    },
  },

  updatePreferences: {
    body: {
      type: "object" as const,
      properties: {
        theme: { type: "string" as const, enum: ["light", "dark", "system", "high_contrast"] },
        language: { type: "string" as const, minLength: 2, maxLength: 10 },
        fontSize: { type: "number" as const, minimum: 10, maximum: 24 },
        compactMode: { type: "boolean" as const },
        notifications: {
          type: "object" as const,
          properties: {
            level: { type: "string" as const, enum: ["none", "critical", "important", "all"] },
            email: { type: "boolean" as const },
            push: { type: "boolean" as const },
            inApp: { type: "boolean" as const },
            sound: { type: "boolean" as const },
            digestFrequency: { type: "string" as const, enum: ["realtime", "hourly", "daily", "weekly"] },
          },
        },
        accessibility: {
          type: "object" as const,
          properties: {
            reducedMotion: { type: "boolean" as const },
            highContrast: { type: "boolean" as const },
            screenReader: { type: "boolean" as const },
            keyboardNavigation: { type: "boolean" as const },
            fontSize: { type: "string" as const, enum: ["small", "medium", "large", "extra_large"] },
          },
        },
        editor: {
          type: "object" as const,
          properties: {
            tabSize: { type: "number" as const, minimum: 1, maximum: 8 },
            insertSpaces: { type: "boolean" as const },
            wordWrap: { type: "boolean" as const },
            lineNumbers: { type: "boolean" as const },
            minimap: { type: "boolean" as const },
            autoSave: { type: "boolean" as const },
            autoSaveDelayMs: { type: "number" as const, minimum: 500, maximum: 10000 },
            formatOnSave: { type: "boolean" as const },
          },
        },
      },
    },
  },
};
