import type { TabType } from './Sidebar';

interface HeaderProps {
  currentTab: TabType;
}

export default function Header({ currentTab }: HeaderProps) {
  const titles: Record<TabType, string> = {
    dashboard: 'System Dashboard & Overview',
    patches: 'Zrok Patches & Features Management',
    categories: 'Categories Management',
    editor: 'App Visual Frontend Editor',
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
