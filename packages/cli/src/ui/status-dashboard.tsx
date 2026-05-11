import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { DEFAULT_PORT } from "@paracosm/shared";

interface ModelStatus {
  id: string;
  provider: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs: number;
  errorRate: number;
  requestsToday: number;
}

interface BudgetInfo {
  dailySpendUsd: number;
  dailyLimitUsd: number;
  monthlySpendUsd: number;
  monthlyLimitUsd: number;
  dailyPercent: number;
  monthlyPercent: number;
}

interface UsageInfo {
  totalTokens: number;
  totalRequests: number;
  avgLatencyMs: number;
  activeConnections: number;
}

interface StatusDashboardProps {
  baseUrl?: string;
  refreshIntervalMs?: number;
}

function StatusIndicator({ status }: { status: string }): React.ReactElement {
  switch (status) {
    case "healthy":
      return <Text color="green">[OK]</Text>;
    case "degraded":
      return <Text color="yellow">[!!]</Text>;
    case "unhealthy":
      return <Text color="red">[XX]</Text>;
    default:
      return <Text dimColor>[??]</Text>;
  }
}

function BudgetBar({
  percent,
  label,
  spend,
  limit,
}: {
  percent: number;
  label: string;
  spend: number;
  limit: number;
}): React.ReactElement {
  const width = 30;
  const filled = Math.min(Math.round((percent / 100) * width), width);
  const empty = width - filled;
  const color = percent > 90 ? "red" : percent > 70 ? "yellow" : "green";

  const bar = "=".repeat(filled) + "-".repeat(empty);

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>{label}</Text>
      </Box>
      <Box>
        <Text color={color}>[{bar}]</Text>
        <Text> </Text>
        <Text color={color}>{percent.toFixed(1)}%</Text>
        <Text> </Text>
        <Text dimColor>
          ${spend.toFixed(2)} / ${limit.toFixed(2)}
        </Text>
      </Box>
    </Box>
  );
}

function ModelStatusRow({ model }: { model: ModelStatus }): React.ReactElement {
  return (
    <Box>
      <StatusIndicator status={model.status} />
      <Text> </Text>
      <Text bold>{model.id}</Text>
      <Text dimColor> ({model.provider})</Text>
      <Text> | </Text>
      <Text>Latency: </Text>
      <Text color={model.latencyMs < 1000 ? "green" : model.latencyMs < 3000 ? "yellow" : "red"}>
        {model.latencyMs}ms
      </Text>
      <Text> | </Text>
      <Text>Error rate: </Text>
      <Text color={model.errorRate < 0.01 ? "green" : model.errorRate < 0.05 ? "yellow" : "red"}>
        {(model.errorRate * 100).toFixed(1)}%
      </Text>
      <Text> | </Text>
      <Text dimColor>Requests: {model.requestsToday}</Text>
    </Box>
  );
}

function UsageSection({ usage }: { usage: UsageInfo }): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Usage
      </Text>
      <Box>
        <Text>  Tokens: </Text>
        <Text>{usage.totalTokens.toLocaleString()}</Text>
        <Text> | Requests: </Text>
        <Text>{usage.totalRequests.toLocaleString()}</Text>
        <Text> | Avg Latency: </Text>
        <Text>{usage.avgLatencyMs}ms</Text>
        <Text> | Connections: </Text>
        <Text>{usage.activeConnections}</Text>
      </Box>
    </Box>
  );
}

export function StatusDashboard({
  baseUrl,
  refreshIntervalMs = 5000,
}: StatusDashboardProps): React.ReactElement {
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [budget, setBudget] = useState<BudgetInfo>({
    dailySpendUsd: 0,
    dailyLimitUsd: 10,
    monthlySpendUsd: 0,
    monthlyLimitUsd: 100,
    dailyPercent: 0,
    monthlyPercent: 0,
  });
  const [usage, setUsage] = useState<UsageInfo>({
    totalTokens: 0,
    totalRequests: 0,
    avgLatencyMs: 0,
    activeConnections: 0,
  });
  const [serverStatus, setServerStatus] = useState<"online" | "offline">("offline");
  const [lastRefresh, setLastRefresh] = useState<string>("");

  const apiBaseUrl = baseUrl ?? `http://localhost:${DEFAULT_PORT}/api/v1`;

  useEffect(() => {
    async function fetchData(): Promise<void> {
      try {
        const heartbeatResponse = await fetch(`${apiBaseUrl}/heartbeat`);
        if (heartbeatResponse.ok) {
          setServerStatus("online");
        } else {
          setServerStatus("offline");
          return;
        }
      } catch {
        setServerStatus("offline");
        return;
      }

      try {
        const providersResponse = await fetch(`${apiBaseUrl}/llm-config/providers`);
        if (providersResponse.ok) {
          const data = (await providersResponse.json()) as Array<Record<string, unknown>>;
          const modelStatuses: ModelStatus[] = data.map((p) => ({
            id: String(p.defaultModelId ?? p.providerId ?? "unknown"),
            provider: String(p.provider ?? "unknown"),
            status: (p.isHealthy ? "healthy" : p.errorRate && Number(p.errorRate) > 0.05 ? "unhealthy" : "degraded") as ModelStatus["status"],
            latencyMs: Number(p.latencyMs ?? 0),
            errorRate: Number(p.errorRate ?? 0),
            requestsToday: Number(p.requestCount ?? 0),
          }));
          setModels(modelStatuses);
        }
      } catch {
        setModels([]);
      }

      try {
        const budgetResponse = await fetch(`${apiBaseUrl}/llm-config/budget`);
        if (budgetResponse.ok) {
          const data = (await budgetResponse.json()) as Record<string, unknown>;
          setBudget({
            dailySpendUsd: Number(data.dailySpendUsd ?? 0),
            dailyLimitUsd: Number(data.dailyLimitUsd ?? 10),
            monthlySpendUsd: Number(data.monthlySpendUsd ?? 0),
            monthlyLimitUsd: Number(data.monthlyLimitUsd ?? 100),
            dailyPercent: Number(data.dailyPercentUsed ?? 0),
            monthlyPercent: Number(data.monthlyPercentUsed ?? 0),
          });
        }
      } catch {
        setBudget((prev) => prev);
      }

      try {
        const usageResponse = await fetch(`${apiBaseUrl}/llm-config/usage?period=day`);
        if (usageResponse.ok) {
          const data = (await usageResponse.json()) as Record<string, unknown>;
          setUsage({
            totalTokens: Number(data.totalTokens ?? 0),
            totalRequests: Number(data.totalRequests ?? 0),
            avgLatencyMs: Number(data.avgLatencyMs ?? 0),
            activeConnections: Number(data.activeConnections ?? 0),
          });
        }
      } catch {
        setUsage((prev) => prev);
      }

      setLastRefresh(new Date().toLocaleTimeString());
    }

    fetchData();
    const interval = setInterval(fetchData, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [apiBaseUrl, refreshIntervalMs]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">
          Paracosm Status Dashboard
        </Text>
        <Text> | </Text>
        <Text>
          Server:{" "}
          <Text color={serverStatus === "online" ? "green" : "red"} bold>
            {serverStatus.toUpperCase()}
          </Text>
        </Text>
        <Text> | </Text>
        <Text dimColor>Refreshed: {lastRefresh || "never"}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="cyan">
          Model Status
        </Text>
        {models.length > 0 ? (
          models.map((model) => (
            <ModelStatusRow key={model.id} model={model} />
          ))
        ) : (
          <Text dimColor>  No model data available</Text>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="cyan">
          Budget
        </Text>
        <BudgetBar
          percent={budget.dailyPercent}
          label="Daily"
          spend={budget.dailySpendUsd}
          limit={budget.dailyLimitUsd}
        />
        <BudgetBar
          percent={budget.monthlyPercent}
          label="Monthly"
          spend={budget.monthlySpendUsd}
          limit={budget.monthlyLimitUsd}
        />
      </Box>

      <Box marginTop={1}>
        <UsageSection usage={usage} />
      </Box>
    </Box>
  );
}
