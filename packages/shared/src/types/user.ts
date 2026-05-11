import type { Timestamped, Identified } from "./common.js";

export type UserId = string & { readonly __brand: unique symbol };

export enum UserTheme {
  Light = "light",
  Dark = "dark",
  System = "system",
  HighContrast = "high_contrast",
}

export enum NotificationLevel {
  None = "none",
  Critical = "critical",
  Important = "important",
  All = "all",
}

export interface UserProfile extends Identified, Timestamped {
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string;
  organization: string | null;
  locale: string;
  timezone: string;
  lastLoginAt: string | null;
  loginCount: number;
  active: boolean;
}

export interface UserPreferences {
  theme: UserTheme;
  language: string;
  fontSize: number;
  compactMode: boolean;
  notifications: NotificationPreferences;
  accessibility: AccessibilityPreferences;
  editor: EditorPreferences;
}

export interface NotificationPreferences {
  level: NotificationLevel;
  email: boolean;
  push: boolean;
  inApp: boolean;
  sound: boolean;
  digestFrequency: "realtime" | "hourly" | "daily" | "weekly";
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export interface AccessibilityPreferences {
  reducedMotion: boolean;
  highContrast: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  fontSize: "small" | "medium" | "large" | "extra_large";
}

export interface EditorPreferences {
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
  autoSave: boolean;
  autoSaveDelayMs: number;
  formatOnSave: boolean;
}

export interface UserConfig extends Identified, Timestamped {
  userId: UserId;
  preferences: UserPreferences;
  customShortcuts: Record<string, string>;
  layoutConfig: Record<string, unknown>;
  featureFlags: Record<string, boolean>;
  apiKeys: Record<string, string>;
  defaultModelId: string | null;
  defaultPersonaIds: string[];
  maxConcurrentSimulations: number;
  budgetLimitUsd: number | null;
}
