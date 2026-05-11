"use client";

interface ConnectionIndicatorProps {
  status: "online" | "disconnected" | "reconnecting";
  size?: "sm" | "md";
}

export function ConnectionIndicator({ status, size = "md" }: ConnectionIndicatorProps) {
  const sizeClasses = size === "sm" ? "w-2 h-2" : "w-3 h-3";

  const getStatusConfig = () => {
    switch (status) {
      case "online":
        return {
          dotClass: "bg-paracosm-green shadow-[0_0_6px_#00ff88]",
          ringClass: "bg-paracosm-green/30",
          label: "Connected",
          labelClass: "text-paracosm-green",
          animate: true,
        };
      case "disconnected":
        return {
          dotClass: "bg-gray-600",
          ringClass: "",
          label: "Disconnected",
          labelClass: "text-gray-500",
          animate: false,
        };
      case "reconnecting":
        return {
          dotClass: "bg-paracosm-yellow shadow-[0_0_6px_#ffcc00]",
          ringClass: "bg-paracosm-yellow/30",
          label: "Reconnecting",
          labelClass: "text-paracosm-yellow",
          animate: true,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={`${sizeClasses} rounded-full ${config.dotClass}`} />
        {config.animate && (
          <div
            className={`absolute inset-0 ${sizeClasses} rounded-full ${config.ringClass} animate-ping`}
          />
        )}
      </div>
      {size === "md" && (
        <span className={`text-xs font-mono ${config.labelClass}`}>
          {config.label}
        </span>
      )}
    </div>
  );
}
