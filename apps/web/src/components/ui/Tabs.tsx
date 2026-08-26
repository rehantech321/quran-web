import { createContext, useContext, useId, useState, type ReactNode } from "react";

import { cn } from "@/utils/cn";

interface TabsContextValue {
  activeValue: string;
  setActiveValue: (value: string) => void;
  idPrefix: string;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs.* components must be used within <Tabs>");
  return ctx;
}

export interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const idPrefix = useId();
  const activeValue = value ?? internalValue;

  function setActiveValue(next: string) {
    setInternalValue(next);
    onValueChange?.(next);
  }

  return (
    <TabsContext.Provider value={{ activeValue, setActiveValue, idPrefix }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex gap-1 border-b border-cream-200", className)}>
      {children}
    </div>
  );
}

export interface TabProps {
  value: string;
  children: ReactNode;
}

export function Tab({ value, children }: TabProps) {
  const { activeValue, setActiveValue, idPrefix } = useTabsContext();
  const isActive = activeValue === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${idPrefix}-tab-${value}`}
      aria-selected={isActive}
      aria-controls={`${idPrefix}-panel-${value}`}
      onClick={() => setActiveValue(value)}
      className={cn(
        "min-h-11 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500",
        isActive
          ? "border-primary-900 text-primary-900"
          : "border-transparent text-ink-600 hover:text-ink-900",
      )}
    >
      {children}
    </button>
  );
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  const { activeValue, idPrefix } = useTabsContext();
  if (activeValue !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
      className="pt-4"
    >
      {children}
    </div>
  );
}
