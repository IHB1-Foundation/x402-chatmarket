'use client';

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type HTMLAttributes,
  forwardRef,
} from 'react';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultTab: string;
  onTabChange?: (tab: string) => void;
}

interface TabsListProps extends HTMLAttributes<HTMLDivElement> {}

interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  value: string;
}

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ defaultTab, onTabChange, className = '', children, ...props }, ref) => {
    const [activeTab, setActiveTabState] = useState(defaultTab);

    const setActiveTab = (tab: string) => {
      setActiveTabState(tab);
      onTabChange?.(tab);
    };

    return (
      <TabsContext.Provider value={{ activeTab, setActiveTab }}>
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);

Tabs.displayName = 'Tabs';

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="tablist"
        className={`
          inline-flex items-center
          p-1
          bg-[var(--color-background-secondary)]
          rounded-[var(--radius-lg)]
          gap-1
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsList.displayName = 'TabsList';

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, className = '', children, ...props }, ref) => {
    const { activeTab, setActiveTab } = useTabsContext();
    const isActive = activeTab === value;

    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={isActive}
        onClick={() => setActiveTab(value)}
        className={`
          px-3 py-1.5
          text-sm font-medium
          rounded-[var(--radius-md)]
          transition-all duration-[var(--transition-fast)]
          cursor-pointer
          ${isActive
            ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }
);

TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className = '', children, ...props }, ref) => {
    const { activeTab } = useTabsContext();

    if (activeTab !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={`mt-4 animate-fade-in ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsContent.displayName = 'TabsContent';
