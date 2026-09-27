import type { TabType } from './Sidebar';

interface HeaderProps {
  currentTab: TabType;
}

export default function Header({ currentTab }: HeaderProps) {
  const titles: Record<TabType, string> = {
    dashboard: 'System Dashboard & Overview',
    licenses: 'License Keys Management',
    categories: 'Feature Categories',
    features: 'Application Features',
    resources: 'Replacement Resources & Files',
    settings: 'System Configuration',
  };

  return (
    <header className="header">
      <div className="header-title">
        <h1>{titles[currentTab]}</h1>
      </div>
      <div className="header-right">
        <div className="status-badge">
          <div className="status-dot"></div>
          <span>API Online</span>
        </div>
      </div>
    </header>
  );
}
