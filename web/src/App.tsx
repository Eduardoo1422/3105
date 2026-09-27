import { useState } from 'react';
import Login from './components/Login';
import Sidebar, { type TabType } from './components/Sidebar';
import Header from './components/Header';
import Toast from './components/Toast';
import DashboardView from './components/views/DashboardView';
import LicenseKeysView from './components/views/LicenseKeysView';
import CategoriesView from './components/views/CategoriesView';
import FeaturesView from './components/views/FeaturesView';
import ResourcesView from './components/views/ResourcesView';
import SettingsView from './components/views/SettingsView';
import { getStoredUser, isAuthenticated, logout } from './services/api';

export default function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);

  const user = getStoredUser();

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
  }

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        user={user}
        onLogout={() => {
          logout();
          setAuthenticated(false);
        }}
      />

      <div className="main-content">
        <Header currentTab={currentTab} />

        {currentTab === 'dashboard' && <DashboardView onNavigate={(tab) => setCurrentTab(tab)} />}
        {currentTab === 'licenses' && <LicenseKeysView onNotify={showToast} />}
        {currentTab === 'categories' && <CategoriesView onNotify={showToast} />}
        {currentTab === 'features' && <FeaturesView onNotify={showToast} />}
        {currentTab === 'resources' && <ResourcesView onNotify={showToast} />}
        {currentTab === 'settings' && <SettingsView user={user} />}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type || 'success'}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
