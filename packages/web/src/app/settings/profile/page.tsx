"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { UserProfile } from "@/components/settings/user-profile";

export default function ProfileSettingsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Profile Settings</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage your user profile and preferences
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <UserProfile />
        </div>
      </div>
    </AppLayout>
  );
}
