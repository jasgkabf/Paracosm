'use client';

interface ConnectionIndicatorProps {
  connected: boolean;
}

export function ConnectionIndicator({ connected }: ConnectionIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${
          connected
            ? 'bg-paracosm-green shadow-glow-green-sm animate-pulse'
            : 'bg-red-500'
        }`}
      />
      <span
        className={`text-xs font-mono ${
          connected ? 'text-paracosm-green' : 'text-red-400'
        }`}
      >
        {connected ? 'CONNECTED' : 'DISCONNECTED'}
      </span>
    </div>
  );
}
