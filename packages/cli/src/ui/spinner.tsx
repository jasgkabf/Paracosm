import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

interface SpinnerProps {
  label?: string;
  type?: "dots" | "line" | "braille" | "arrow";
  color?: string;
}

const SPINNER_FRAMES: Record<string, string[]> = {
  dots: [".", "o", "O", "o"],
  line: ["-", "\\", "|", "/"],
  braille: ["   ", ".  ", ".. ", "..."],
  arrow: ["<", "<<", "<<<", "<<", "<"],
};

export function Spinner({
  label = "Loading",
  type = "line",
  color = "cyan",
}: SpinnerProps): React.ReactElement {
  const frames = SPINNER_FRAMES[type] ?? SPINNER_FRAMES.line;
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, 120);
    return () => clearInterval(timer);
  }, [frames.length]);

  return (
    <Box>
      <Text color={color}>{frames[frameIndex]}</Text>
      <Text> </Text>
      <Text>{label}</Text>
    </Box>
  );
}
