export type UserTheme = 'light' | 'dark' | 'system';
export interface UserProfile {
    id: string;
    username: string;
    email: string;
    displayName: string;
    avatar?: string;
    createdAt: Date;
    updatedAt: Date;
    metadata: Record<string, unknown>;
}
export interface UserPreferences {
    theme: UserTheme;
    language: string;
    timezone: string;
    notifications: boolean;
    compactMode: boolean;
    defaultPersona: string;
    defaultModel: string;
    metadata: Record<string, unknown>;
}
export interface UserConfig {
    profile: UserProfile;
    preferences: UserPreferences;
    apiKeys: Record<string, string>;
    enabledTools: string[];
    enabledPersonas: string[];
    budgetLimits: {
        daily: number;
        monthly: number;
    };
    metadata: Record<string, unknown>;
}
//# sourceMappingURL=user.d.ts.map