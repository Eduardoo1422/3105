import type { AuthUser } from '../types';

export type TabType = 'dashboard' | 'patches' | 'categories' | 'editor' | 'settings';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  user: AuthUser | null;
  onLogout: () => void;
}

export default function Sidebar({ currentTab, onSelectTab, user, onLogout }: SidebarProps) {
  const menuItems: { id: TabType; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'patches', label: 'Patches & Features', icon: '📦' },
    { id: 'categories', label: 'Categories', icon: '🏷️' },
    { id: 'editor', label: 'App Layout Editor', icon: '📱' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">Z</div>
        <div>
          <div className="sidebar-title">ZROK</div>
          <div className="sidebar-subtitle">Patch Manager</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
            onClick={() => onSelectTab(item.id)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <span className="user-name">{user?.username || 'Administrator'}</span>
          <span className="user-role">{user?.role || 'ADMIN'}</span>
        </div>
        <button className="logout-btn" onClick={onLogout} title="Sair">
          Logout
        </button>
      </div>
    </aside>
  );
}
