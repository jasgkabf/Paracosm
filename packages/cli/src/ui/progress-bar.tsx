import React from "react";
import { Box, Text } from "ink";

interface ProgressBarProps {
  value: number;
  max?: number;
  width?: number;
  label?: string;
  showPercent?: boolean;
  showValues?: boolean;
  color?: string;
  bgColor?: string;
}

export function ProgressBar({
  value,
  max = 100,
  width = 30,
  label,
  showPercent = true,
  showValues = false,
  color = "cyan",
  bgColor = "gray",
}: ProgressBarProps): React.ReactElement {
  const percent = Math.min(Math.max(value / max, 0), 1);
  const filledWidth = Math.round(percent * width);
  const emptyWidth = width - filledWidth;

  const filled = "=".repeat(filledWidth);
  const empty = "-".repeat(emptyWidth);

  const barColor = percent > 0.9 ? "red" : percent > 0.7 ? "yellow" : color;

  return (
    <Box>
      {label && (
        <Box>
          <Text bold>{label}</Text>
          <Text> </Text>
        </Box>
      )}
      <Text color={bgColor}>[</Text>
      <Text color={barColor}>{filled}</Text>
      <Text color={bgColor}>{empty}</Text>
      <Text color={bgColor}>]</Text>
      {showPercent && (
        <Box>
          <Text> </Text>
          <Text color={barColor} bold>
            {(percent * 100).toFixed(1)}%
          </Text>
        </Box>
      )}
      {showValues && (
        <Box>
          <Text> </Text>
          <Text dimColor>
            {value}/{max}
          </Text>
        </Box>
      )}
    </Box>
  );
}
