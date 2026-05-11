"use client";

import { Button } from "@/components/common/button";
import { IconDollar, IconRefresh } from "@/components/icons";
import { useState } from "react";

export function BudgetConfig() {
  const [dailyLimit, setDailyLimit] = useState(10);
  const [monthlyLimit, setMonthlyLimit] = useState(200);
  const [perRequestLimit, setPerRequestLimit] = useState(0.5);
  const [alertThreshold, setAlertThreshold] = useState(80);

  const todaySpend = 3.42;
  const monthSpend = 87.50;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <IconDollar size={16} className="text-paracosm-green" />
            <span className="text-sm text-gray-400">Today&apos;s Spend</span>
          </div>
          <div className="text-2xl font-mono text-white">${todaySpend.toFixed(2)}</div>
          <div className="mt-2">
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill bg-paracosm-green"
                style={{ width: `${(todaySpend / dailyLimit) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
              <span>${todaySpend.toFixed(2)} spent</span>
              <span>${dailyLimit.toFixed(2)} limit</span>
            </div>
          </div>
        </div>

        <div className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <IconDollar size={16} className="text-paracosm-cyan" />
            <span className="text-sm text-gray-400">Monthly Spend</span>
          </div>
          <div className="text-2xl font-mono text-white">${monthSpend.toFixed(2)}</div>
          <div className="mt-2">
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill bg-paracosm-cyan"
                style={{ width: `${(monthSpend / monthlyLimit) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
              <span>${monthSpend.toFixed(2)} spent</span>
              <span>${monthlyLimit.toFixed(2)} limit</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-4 space-y-4">
        <h3 className="text-sm font-medium text-white">Budget Limits</h3>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-gray-400">Daily Limit ($)</label>
            <span className="text-sm font-mono text-white">${dailyLimit}</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(Number(e.target.value))}
            className="w-full accent-paracosm-green"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-gray-400">Monthly Limit ($)</label>
            <span className="text-sm font-mono text-white">${monthlyLimit}</span>
          </div>
          <input
            type="range"
            min="10"
            max="1000"
            step="10"
            value={monthlyLimit}
            onChange={(e) => setMonthlyLimit(Number(e.target.value))}
            className="w-full accent-paracosm-cyan"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-gray-400">Per-Request Limit ($)</label>
            <span className="text-sm font-mono text-white">${perRequestLimit}</span>
          </div>
          <input
            type="range"
            min="0.01"
            max="5"
            step="0.01"
            value={perRequestLimit}
            onChange={(e) => setPerRequestLimit(Number(e.target.value))}
            className="w-full accent-paracosm-yellow"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-gray-400">Alert Threshold (%)</label>
            <span className="text-sm font-mono text-white">{alertThreshold}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="100"
            step="5"
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(Number(e.target.value))}
            className="w-full accent-paracosm-orange"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="primary">Save Budget Settings</Button>
      </div>
    </div>
  );
}
