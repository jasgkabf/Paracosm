"use client";

interface VitalSigns {
  bpm: number;
  status: string;
  delay: number;
  uptime: number;
}

interface VitalSignsDisplayProps {
  vitalSigns: VitalSigns;
}

export function VitalSignsDisplay({ vitalSigns }: VitalSignsDisplayProps) {
  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "normal":
        return "text-paracosm-green";
      case "elevated":
        return "text-paracosm-yellow";
      case "critical":
        return "text-paracosm-red";
      case "flatline":
        return "text-paracosm-red";
      default:
        return "text-gray-400";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "normal":
        return "NORMAL";
      case "elevated":
        return "ELEVATED";
      case "critical":
        return "CRITICAL";
      case "flatline":
        return "FLATLINE";
      default:
        return status.toUpperCase();
    }
  };

  return (
    <div className="glass-panel p-4 h-full flex flex-col justify-between">
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Heart Rate
          </div>
          <div className="medical-display text-5xl font-bold">
            {vitalSigns.bpm}
          </div>
          <div className="text-xs text-gray-500 mt-1">BPM</div>
        </div>

        <div className="h-px bg-paracosm-green/10" />

        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Status
          </div>
          <div className={`text-lg font-mono font-bold ${getStatusColor(vitalSigns.status)} ecg-glow`}>
            {getStatusLabel(vitalSigns.status)}
          </div>
        </div>

        <div className="h-px bg-paracosm-green/10" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">
              Delay
            </div>
            <div className="medical-display text-lg mt-1">
              {vitalSigns.delay}<span className="text-xs text-gray-500 ml-1">ms</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">
              Uptime
            </div>
            <div className="medical-display text-lg mt-1">
              {formatUptime(vitalSigns.uptime)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-paracosm-green/10">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Lead II</span>
          <span>25mm/s</span>
        </div>
      </div>
    </div>
  );
}
