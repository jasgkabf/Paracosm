"use client";

import { Button } from "@/components/common/button";
import { IconUser, IconEdit } from "@/components/icons";
import { useState } from "react";

export function UserProfile() {
  const [name, setName] = useState("Agent Operator");
  const [email, setEmail] = useState("operator@paracosm.local");
  const [role, setRole] = useState("admin");
  const [theme, setTheme] = useState("dark");
  const [language, setLanguage] = useState("en");
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-xl bg-paracosm-green/20 flex items-center justify-center">
            <IconUser size={32} className="text-paracosm-green" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{name}</h3>
            <p className="text-sm text-gray-400">{email}</p>
            <span className="text-xs text-paracosm-cyan capitalize">{role}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green/50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green/50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green/50"
            >
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 space-y-4">
        <h3 className="text-sm font-medium text-white">Preferences</h3>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Theme</label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green/50"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green/50"
          >
            <option value="en">English</option>
            <option value="zh">Chinese</option>
            <option value="ja">Japanese</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="primary">Save Profile</Button>
      </div>
    </div>
  );
}
