import React from 'react';
import { Box, Text } from 'ink';

interface SpinnerProps {
  label?: string;
  color?: string;
}

const FRAMES = ['|', '/', '-', '\\'];

export function Spinner({ label = 'Loading', color = 'green' }: SpinnerProps) {
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % FRAMES.length);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box>
      <Text color={color as any}>{FRAMES[frame]}</Text>
      <Text> {label}...</Text>
    </Box>
  );
}
