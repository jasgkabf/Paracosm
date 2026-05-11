"use client";

interface PageContainerProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageContainer({ children, title, description, actions }: PageContainerProps) {
  return (
    <div className="flex flex-col h-full p-6 gap-6 overflow-hidden">
      {(title || actions) && (
        <div className="flex items-center justify-between">
          <div>
            {title && (
              <h1 className="text-2xl font-semibold text-white">{title}</h1>
            )}
            {description && (
              <p className="text-sm text-gray-400 mt-1">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
