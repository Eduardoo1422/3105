import React, { useState, useEffect } from 'react';
import { getAppConfig, saveAppDraft, publishAppConfig } from '../../services/api';

interface AppElement {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'toggle' | 'action' | 'info' | 'card' | 'separator';
  enabled: boolean;
  order: number;
}

interface AppTab {
  id: string;
  name: string;
  icon: string;
  order: number;
  elements: AppElement[];
}

interface HeroConfig {
  imageUrl: string;
  title: string;
  subtitle: string;
}

interface ThemeConfig {
  background: string;
  cardBackground: string;
  textColor: string;
  secondaryText: string;
  buttonColor: string;
  accentColor: string;
  borderColor: string;
}

interface AppConfigPayload {
  tabs: AppTab[];
  hero: HeroConfig;
  theme: ThemeConfig;
}

interface ServerConfigData {
  draft: AppConfigPayload;
  published: AppConfigPayload;
  publishedVersion: number;
  publishedAt: string;
  devices: Array<{
    deviceIdentifier: string;
    platform: string;
    appVersion: string;
    lastSyncedVersion: number;
    clientReportedStatus?: string;
    syncStatus?: string;
    matchesCurrentPublishedVersion?: boolean;
    lastSyncAt: string;
  }>;
}

const DEFAULT_PAYLOAD: AppConfigPayload = {
  tabs: [
    {
      id: 'home',
      name: 'Início',
      icon: '🏠',
      order: 0,
      elements: [
        { id: 'elem-1', name: 'Anti-Ban Protection', description: 'Advanced kernel telemetry shield active for Free Fire', icon: '🛡️', type: 'toggle', enabled: true, order: 0 },
        { id: 'elem-2', name: 'Instant Patch Loader', description: 'Inject memory patches and bundles on startup', icon: '⚡', type: 'action', enabled: true, order: 1 }
      ]
    },
    {
      id: 'cleaner',
      name: 'Limpeza',
      icon: '🧹',
      order: 1,
      elements: [
        { id: 'elem-3', name: 'Cache Cleaner', description: 'Purge temporary game assets and logs', icon: '🗑️', type: 'action', enabled: true, order: 0 }
      ]
    }
  ],
  hero: { imageUrl: '', title: 'ZROK Enterprise v2.0', subtitle: 'Free Fire Advanced Customization & Patch Center' },
  theme: { background: '#0b0f19', cardBackground: '#131c31', textColor: '#f8fafc', secondaryText: '#94a3b8', buttonColor: '#3b82f6', accentColor: '#10b981', borderColor: '#1e293b' }
};

interface AppEditorViewProps {
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

export default function AppEditorView({ onNotify }: AppEditorViewProps) {
  const [serverData, setServerData] = useState<ServerConfigData | null>(null);
  const [draft, setDraft] = useState<AppConfigPayload>(DEFAULT_PAYLOAD);
  const [savedDraft, setSavedDraft] = useState<AppConfigPayload>(DEFAULT_PAYLOAD);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);

  // Active section in editor: 'tabs' | 'banner' | 'theme' | 'devices'
  const [activeEditorSection, setActiveEditorSection] = useState<'tabs' | 'banner' | 'theme' | 'devices'>('tabs');
  
  // Selected tab for editing functions
  const [selectedTabId, setSelectedTabId] = useState<string>('home');
  
  // Selected element for property editing
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Active tab in phone simulator
  const [simulatedActiveTabId, setSimulatedActiveTabId] = useState<string>('home');

  // Modals state
  const [showTabModal, setShowTabModal] = useState<boolean>(false);
  const [editingTab, setEditingTab] = useState<AppTab | null>(null);
  const [tabModalName, setTabModalName] = useState<string>('');
  const [tabModalIcon, setTabModalIcon] = useState<string>('⭐');

  const [showElementModal, setShowElementModal] = useState<boolean>(false);
  const [editingElement, setEditingElement] = useState<AppElement | null>(null);
  const [elemModalName, setElemModalName] = useState<string>('');
  const [elemModalDesc, setElemModalDesc] = useState<string>('');
  const [elemModalIcon, setElemModalIcon] = useState<string>('⚡');
  const [elemModalType, setElemModalType] = useState<'toggle' | 'action' | 'info' | 'card' | 'separator'>('toggle');
  const [elemModalEnabled, setElemModalEnabled] = useState<boolean>(true);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      setLoading(true);
      const data = await getAppConfig();
      if (data && data.draft) {
        setServerData(data);
        setDraft(data.draft);
        setSavedDraft(JSON.parse(JSON.stringify(data.draft)));
        if (data.draft.tabs && data.draft.tabs[0]) {
          setSelectedTabId(data.draft.tabs[0].id);
          setSimulatedActiveTabId(data.draft.tabs[0].id);
        }
      } else {
        setServerData({
          draft: DEFAULT_PAYLOAD,
          published: DEFAULT_PAYLOAD,
          publishedVersion: 1,
          publishedAt: new Date().toISOString(),
          devices: []
        });
        setDraft(DEFAULT_PAYLOAD);
        setSavedDraft(DEFAULT_PAYLOAD);
      }
    } catch (err: any) {
      console.warn('Failed to load app config from server:', err);
      onNotify('Failed to load configuration from server', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    try {
      setSaving(true);
      const res = await saveAppDraft(draft);
      setServerData(res);
      setDraft(res.draft);
      setSavedDraft(JSON.parse(JSON.stringify(res.draft)));
      onNotify('Draft saved successfully on server.', 'success');
    } catch (err: any) {
      onNotify(err.message || 'Failed to save draft', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!window.confirm('Are you sure you want to publish these changes? Connected iOS apps will receive this new version upon sync.')) {
      return;
    }
    try {
      setPublishing(true);
      const res = await publishAppConfig();
      setServerData(res);
      setDraft(res.draft);
      setSavedDraft(JSON.parse(JSON.stringify(res.draft)));
      onNotify(`Configuration successfully published as v${res.publishedVersion}!`, 'success');
    } catch (err: any) {
      onNotify(err.message || 'Failed to publish configuration', 'error');
    } finally {
      setPublishing(false);
    }
  }

  function handleDiscard() {
    setDraft(JSON.parse(JSON.stringify(savedDraft)));
    onNotify('Unsaved draft changes discarded.', 'success');
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);

  // Tab management handlers
  function openCreateTabModal() {
    setEditingTab(null);
    setTabModalName('');
    setTabModalIcon('📂');
    setShowTabModal(true);
  }

  function openEditTabModal(tab: AppTab) {
    setEditingTab(tab);
    setTabModalName(tab.name);
    setTabModalIcon(tab.icon);
    setShowTabModal(true);
  }

  function handleSaveTab(e: React.FormEvent) {
    e.preventDefault();
    if (!tabModalName.trim()) return;

    const slug = tabModalName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');

    if (editingTab) {
      const updatedTabs = draft.tabs.map((t) =>
        t.id === editingTab.id ? { ...t, name: tabModalName, icon: tabModalIcon } : t
      );
      setDraft({ ...draft, tabs: updatedTabs });
      onNotify(`Tab "${tabModalName}" updated in draft.`);
    } else {
      if (draft.tabs.some((t) => t.id === slug || t.name.toLowerCase() === tabModalName.toLowerCase())) {
        onNotify('A tab with this name or identifier already exists.', 'error');
        return;
      }
      const newTab: AppTab = {
        id: slug || `tab-${Date.now()}`,
        name: tabModalName,
        icon: tabModalIcon,
        order: draft.tabs.length,
        elements: []
      };
      const updatedTabs = [...draft.tabs, newTab];
      setDraft({ ...draft, tabs: updatedTabs });
      setSelectedTabId(newTab.id);
      setSimulatedActiveTabId(newTab.id);
      onNotify(`Tab "${tabModalName}" created in draft.`);
    }
    setShowTabModal(false);
  }

  function handleDeleteTab(tabId: string) {
    if (draft.tabs.length <= 1) {
      onNotify('You must keep at least one tab in the application.', 'error');
      return;
    }
    if (window.confirm('Are you sure you want to delete this tab from draft?')) {
      const updatedTabs = draft.tabs.filter((t) => t.id !== tabId);
      setDraft({ ...draft, tabs: updatedTabs });
      if (selectedTabId === tabId) setSelectedTabId(updatedTabs[0].id);
      if (simulatedActiveTabId === tabId) setSimulatedActiveTabId(updatedTabs[0].id);
      onNotify('Tab deleted from draft.');
    }
  }

  function moveTab(index: number, direction: 'up' | 'down') {
    const newTabs = [...draft.tabs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTabs.length) return;
    const temp = newTabs[index];
    newTabs[index] = newTabs[targetIndex];
    newTabs[targetIndex] = temp;
    newTabs.forEach((t, i) => (t.order = i));
    setDraft({ ...draft, tabs: newTabs });
  }

  // Element management
  const currentSelectedTab = draft.tabs.find((t) => t.id === selectedTabId) || draft.tabs[0];

  function openCreateElementModal() {
    setEditingElement(null);
    setElemModalName('');
    setElemModalDesc('');
    setElemModalIcon('⚡');
    setElemModalType('toggle');
    setElemModalEnabled(true);
    setShowElementModal(true);
  }

  function openEditElementModal(elem: AppElement) {
    setEditingElement(elem);
    setElemModalName(elem.name);
    setElemModalDesc(elem.description);
    setElemModalIcon(elem.icon);
    setElemModalType(elem.type);
    setElemModalEnabled(elem.enabled);
    setShowElementModal(true);
  }

  function handleSaveElement(e: React.FormEvent) {
    e.preventDefault();
    if (!elemModalName.trim()) return;

    const targetTab = draft.tabs.find((t) => t.id === selectedTabId);
    if (!targetTab) return;

    if (editingElement) {
      const updatedElements = targetTab.elements.map((el) =>
        el.id === editingElement.id
          ? { ...el, name: elemModalName, description: elemModalDesc, icon: elemModalIcon, type: elemModalType, enabled: elemModalEnabled }
          : el
      );
      const updatedTabs = draft.tabs.map((t) =>
        t.id === selectedTabId ? { ...t, elements: updatedElements } : t
      );
      setDraft({ ...draft, tabs: updatedTabs });
      onNotify(`Function "${elemModalName}" updated in draft.`);
    } else {
      const newElem: AppElement = {
        id: `elem-${Date.now()}`,
        name: elemModalName,
        description: elemModalDesc,
        icon: elemModalIcon,
        type: elemModalType,
        enabled: elemModalEnabled,
        order: targetTab.elements.length
      };
      const updatedElements = [...targetTab.elements, newElem];
      const updatedTabs = draft.tabs.map((t) =>
        t.id === selectedTabId ? { ...t, elements: updatedElements } : t
      );
      setDraft({ ...draft, tabs: updatedTabs });
      onNotify(`Function "${elemModalName}" added to draft.`);
    }
    setShowElementModal(false);
  }

  function handleDeleteElement(elemId: string) {
    const targetTab = draft.tabs.find((t) => t.id === selectedTabId);
    if (!targetTab) return;

    const updatedElements = targetTab.elements.filter((el) => el.id !== elemId);
    const updatedTabs = draft.tabs.map((t) =>
      t.id === selectedTabId ? { ...t, elements: updatedElements } : t
    );
    setDraft({ ...draft, tabs: updatedTabs });
    if (selectedElementId === elemId) setSelectedElementId(null);
    onNotify('Function removed from draft.');
  }

  function handleDuplicateElement(elem: AppElement) {
    const targetTab = draft.tabs.find((t) => t.id === selectedTabId);
    if (!targetTab) return;

    const duplicated: AppElement = {
      ...elem,
      id: `elem-${Date.now()}`,
      name: `${elem.name} (Copy)`,
      order: targetTab.elements.length
    };
    const updatedElements = [...targetTab.elements, duplicated];
    const updatedTabs = draft.tabs.map((t) =>
      t.id === selectedTabId ? { ...t, elements: updatedElements } : t
    );
    setDraft({ ...draft, tabs: updatedTabs });
    onNotify('Function duplicated in draft.');
  }

  function moveElement(index: number, direction: 'up' | 'down') {
    const targetTab = draft.tabs.find((t) => t.id === selectedTabId);
    if (!targetTab) return;

    const newElems = [...targetTab.elements];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newElems.length) return;
    const temp = newElems[index];
    newElems[index] = newElems[targetIndex];
    newElems[targetIndex] = temp;
    newElems.forEach((el, i) => (el.order = i));

    const updatedTabs = draft.tabs.map((t) =>
      t.id === selectedTabId ? { ...t, elements: newElems } : t
    );
    setDraft({ ...draft, tabs: updatedTabs });
  }

  const selectedElement = currentSelectedTab?.elements.find((el) => el.id === selectedElementId);

  if (loading) {
    return (
      <div className="content-body" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading App Editor & Publication Center...</p>
      </div>
    );
  }

  return (
    <div className="content-body" style={{ gap: '20px' }}>
      {/* Top Banner / Actions Bar with Draft vs Published Info */}
      <div className="card" style={{ padding: '16px 24px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>ZROK App Visual Frontend Editor</h2>
            <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
              Published v{serverData?.publishedVersion || 1}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Live preview updates instantly. Save draft locally on server, then publish to sync with real iOS apps.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {isDirty && (
            <span className="badge badge-warning" style={{ fontSize: '12px' }}>
              ⚠️ Draft has unsaved changes
            </span>
          )}
          <button className="btn btn-secondary" onClick={handleDiscard} disabled={!isDirty || saving}>
            Discard Draft
          </button>
          <button className="btn btn-secondary" onClick={handleSaveDraft} disabled={!isDirty || saving}>
            {saving ? 'Saving Draft...' : '💾 Salvar Rascunho'}
          </button>
          <button className="btn btn-primary" onClick={handlePublish} disabled={publishing}>
            {publishing ? 'Publishing...' : '🚀 Publicar Alterações'}
          </button>
        </div>
      </div>

      {/* Main 3-Column Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px 320px', gap: '20px', alignItems: 'start' }}>
        
        {/* AREA 1: Configuration Panel */}
        <div className="card" style={{ gap: '16px', minHeight: '650px' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className={`btn ${activeEditorSection === 'tabs' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveEditorSection('tabs')}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              📂 Tabs & Functions
            </button>
            <button
              className={`btn ${activeEditorSection === 'banner' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveEditorSection('banner')}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              🖼️ Hero & Banner
            </button>
            <button
              className={`btn ${activeEditorSection === 'theme' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveEditorSection('theme')}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              🎨 Theme & Colors
            </button>
            <button
              className={`btn ${activeEditorSection === 'devices' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveEditorSection('devices')}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              📱 iOS Sync Status ({serverData?.devices?.length || 0})
            </button>
          </div>

          {activeEditorSection === 'tabs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Application Tabs (Draft)</span>
                  <button className="btn btn-primary" onClick={openCreateTabModal} style={{ padding: '6px 12px', fontSize: '12px' }}>
                    + New Tab
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {draft.tabs.map((tab, idx) => (
                    <div
                      key={tab.id}
                      onClick={() => {
                        setSelectedTabId(tab.id);
                        setSimulatedActiveTabId(tab.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        backgroundColor: selectedTabId === tab.id ? 'var(--accent-light)' : 'var(--bg-input)',
                        border: `1px solid ${selectedTabId === tab.id ? 'var(--accent)' : 'var(--border-color)'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <span>{tab.icon}</span>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: selectedTabId === tab.id ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {tab.name}
                      </span>
                      <div style={{ display: 'flex', gap: '4px', marginLeft: '6px' }} onClick={(e) => e.stopPropagation()}>
                        <button title="Move Up" onClick={() => moveTab(idx, 'up')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px' }}>▲</button>
                        <button title="Move Down" onClick={() => moveTab(idx, 'down')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px' }}>▼</button>
                        <button title="Edit Tab" onClick={() => openEditTabModal(tab)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
                        <button title="Delete Tab" onClick={() => handleDeleteTab(tab.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Functions in "{currentSelectedTab?.name}"
                  </span>
                  <button className="btn btn-primary" onClick={openCreateElementModal} style={{ padding: '6px 12px', fontSize: '12px' }}>
                    + Adicionar função
                  </button>
                </div>

                {currentSelectedTab?.elements.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No functions in this tab yet. Click "+ Adicionar função".
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentSelectedTab?.elements.map((elem, idx) => (
                      <div
                        key={elem.id}
                        onClick={() => setSelectedElementId(elem.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          backgroundColor: selectedElementId === elem.id ? 'var(--bg-hover)' : 'var(--bg-input)',
                          border: `1px solid ${selectedElementId === elem.id ? 'var(--accent)' : 'var(--border-color)'}`,
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px' }}>{elem.icon}</span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{elem.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{elem.description || 'No description'}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                          <span className={`badge ${elem.enabled ? 'badge-active' : 'badge-inactive'}`}>
                            {elem.type}
                          </span>
                          <button title="Move Up" onClick={() => moveElement(idx, 'up')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px' }}>▲</button>
                          <button title="Move Down" onClick={() => moveElement(idx, 'down')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px' }}>▼</button>
                          <button title="Duplicate" onClick={() => handleDuplicateElement(elem)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>📋</button>
                          <button title="Edit" onClick={() => openEditElementModal(elem)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                          <button title="Delete" onClick={() => handleDeleteElement(elem.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeEditorSection === 'banner' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Hero Image & Header (Draft)</h3>
              <label>
                Banner Title
                <input
                  type="text"
                  value={draft.hero.title}
                  onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, title: e.target.value } })}
                />
              </label>
              <label>
                Banner Subtitle
                <input
                  type="text"
                  value={draft.hero.subtitle}
                  onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, subtitle: e.target.value } })}
                />
              </label>
              <label>
                Hero Image URL or Placeholder
                <input
                  type="text"
                  placeholder="https://example.com/banner.png"
                  value={draft.hero.imageUrl}
                  onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, imageUrl: e.target.value } })}
                />
              </label>
              <button
                className="btn btn-secondary"
                onClick={() => setDraft({ ...draft, hero: { ...draft.hero, imageUrl: '' } })}
                style={{ width: 'fit-content' }}
              >
                Restore Default Banner Art
              </button>
            </div>
          )}

          {activeEditorSection === 'theme' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Theme & Colors (Draft)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Background
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={draft.theme.background}
                      onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, background: e.target.value } })}
                      style={{ width: '40px', height: '36px', padding: '0', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={draft.theme.background}
                      onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, background: e.target.value } })}
                    />
                  </div>
                </label>

                <label>
                  Card Background
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={draft.theme.cardBackground}
                      onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, cardBackground: e.target.value } })}
                      style={{ width: '40px', height: '36px', padding: '0', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={draft.theme.cardBackground}
                      onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, cardBackground: e.target.value } })}
                    />
                  </div>
                </label>

                <label>
                  Primary Text
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={draft.theme.textColor}
                      onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, textColor: e.target.value } })}
                      style={{ width: '40px', height: '36px', padding: '0', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={draft.theme.textColor}
                      onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, textColor: e.target.value } })}
                    />
                  </div>
                </label>

                <label>
                  Secondary Text
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={draft.theme.secondaryText}
                      onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, secondaryText: e.target.value } })}
                      style={{ width: '40px', height: '36px', padding: '0', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={draft.theme.secondaryText}
                      onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, secondaryText: e.target.value } })}
                    />
                  </div>
                </label>

                <label>
                  Button Color
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={draft.theme.buttonColor}
                      onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, buttonColor: e.target.value } })}
                      style={{ width: '40px', height: '36px', padding: '0', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={draft.theme.buttonColor}
                      onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, buttonColor: e.target.value } })}
                    />
                  </div>
                </label>

                <label>
                  Accent Color
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={draft.theme.accentColor}
                      onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, accentColor: e.target.value } })}
                      style={{ width: '40px', height: '36px', padding: '0', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={draft.theme.accentColor}
                      onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, accentColor: e.target.value } })}
                    />
                  </div>
                </label>
              </div>
            </div>
          )}

          {activeEditorSection === 'devices' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Connected iOS Devices & Sync Status</h3>
                <span className="badge badge-active">Active Sync Endpoint</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Shows real-time synchronization state of each iOS client reporting back to the server.
              </p>

              {(!serverData?.devices || serverData.devices.length === 0) ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                  No iOS devices have connected or reported sync status yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {serverData.devices.map((dev, idx) => {
                    const status = dev.clientReportedStatus || dev.syncStatus || 'unknown';
                    const matches = dev.matchesCurrentPublishedVersion ?? (dev.lastSyncedVersion === serverData.publishedVersion);
                    return (
                      <div key={idx} style={{ padding: '12px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>📱 {dev.deviceIdentifier}</span>
                          <span className={`badge ${matches ? 'badge-active' : 'badge-warning'}`}>
                            {matches ? `✓ Synced v${dev.lastSyncedVersion} (Current v${serverData.publishedVersion})` : `Pending v${dev.lastSyncedVersion} -> v${serverData.publishedVersion}`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span>Platform: {dev.platform} | App v{dev.appVersion}</span>
                          <span>Reported Status: {status} | Last Seen: {new Date(dev.lastSyncAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* AREA 2: Real-time Phone Simulator (Renders Draft immediately) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📱 Live Simulator (Draft View)
          </div>

          <div
            style={{
              width: '340px',
              height: '660px',
              backgroundColor: draft.theme.background,
              borderRadius: '40px',
              border: '10px solid #27272a',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              color: draft.theme.textColor
            }}
          >
            <div style={{ height: '34px', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', fontSize: '11px', fontWeight: 600 }}>
              <span>9:41</span>
              <div style={{ width: '80px', height: '14px', backgroundColor: '#000', borderRadius: '10px' }} />
              <span>5G 🔋</span>
            </div>

            <div style={{ padding: '16px', background: `linear-gradient(135deg, ${draft.theme.cardBackground}, ${draft.theme.background})`, borderBottom: `1px solid ${draft.theme.borderColor}`, textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 8px', borderRadius: '12px', background: 'linear-gradient(135deg, #ef4444, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                🔥
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: draft.theme.textColor }}>{draft.hero.title}</div>
              <div style={{ fontSize: '11px', color: draft.theme.secondaryText, marginTop: '2px' }}>{draft.hero.subtitle}</div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(() => {
                const activeTab = draft.tabs.find((t) => t.id === simulatedActiveTabId) || draft.tabs[0];
                if (!activeTab || activeTab.elements.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', color: draft.theme.secondaryText, marginTop: '40px', fontSize: '13px' }}>
                      No elements in this tab.
                    </div>
                  );
                }
                return activeTab.elements.map((elem) => (
                  <div
                    key={elem.id}
                    style={{
                      backgroundColor: draft.theme.cardBackground,
                      border: `1px solid ${draft.theme.borderColor}`,
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>{elem.icon}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: draft.theme.textColor }}>{elem.name}</div>
                        <div style={{ fontSize: '10px', color: draft.theme.secondaryText }}>{elem.description}</div>
                      </div>
                    </div>

                    <div>
                      {elem.type === 'toggle' && (
                        <div
                          style={{
                            width: '36px',
                            height: '20px',
                            borderRadius: '10px',
                            backgroundColor: elem.enabled ? draft.theme.buttonColor : '#4b5563',
                            position: 'relative'
                          }}
                        >
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              backgroundColor: '#fff',
                              position: 'absolute',
                              top: '2px',
                              left: elem.enabled ? '18px' : '2px',
                              transition: 'left 0.2s'
                            }}
                          />
                        </div>
                      )}
                      {elem.type === 'action' && (
                        <button
                          style={{
                            backgroundColor: draft.theme.buttonColor,
                            color: '#fff',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600
                          }}
                        >
                          Run
                        </button>
                      )}
                      {elem.type === 'info' && (
                        <span style={{ fontSize: '10px', color: draft.theme.accentColor, fontWeight: 600 }}>ACTIVE</span>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div style={{ height: '60px', backgroundColor: draft.theme.cardBackground, borderTop: `1px solid ${draft.theme.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 8px' }}>
              {draft.tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSimulatedActiveTabId(tab.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    cursor: 'pointer',
                    color: simulatedActiveTabId === tab.id ? draft.theme.accentColor : draft.theme.secondaryText,
                    fontSize: '10px'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AREA 3: Properties Panel */}
        <div className="card" style={{ gap: '16px', minHeight: '650px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            ⚙️ Element Properties
          </h3>

          {selectedElement ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SELECTED ID:</span>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{selectedElement.id}</div>
              </div>

              <label>
                Name / Title
                <input
                  type="text"
                  value={selectedElement.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updatedTabs = draft.tabs.map((t) =>
                      t.id === selectedTabId
                        ? {
                            ...t,
                            elements: t.elements.map((el) => (el.id === selectedElement.id ? { ...el, name: val } : el))
                          }
                        : t
                    );
                    setDraft({ ...draft, tabs: updatedTabs });
                  }}
                />
              </label>

              <label>
                Description
                <textarea
                  rows={2}
                  value={selectedElement.description}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updatedTabs = draft.tabs.map((t) =>
                      t.id === selectedTabId
                        ? {
                            ...t,
                            elements: t.elements.map((el) => (el.id === selectedElement.id ? { ...el, description: val } : el))
                          }
                        : t
                    );
                    setDraft({ ...draft, tabs: updatedTabs });
                  }}
                />
              </label>

              <label>
                Icon (Emoji)
                <input
                  type="text"
                  value={selectedElement.icon}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updatedTabs = draft.tabs.map((t) =>
                      t.id === selectedTabId
                        ? {
                            ...t,
                            elements: t.elements.map((el) => (el.id === selectedElement.id ? { ...el, icon: val } : el))
                          }
                        : t
                    );
                    setDraft({ ...draft, tabs: updatedTabs });
                  }}
                />
              </label>

              <label>
                Element Type
                <select
                  value={selectedElement.type}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    const updatedTabs = draft.tabs.map((t) =>
                      t.id === selectedTabId
                        ? {
                            ...t,
                            elements: t.elements.map((el) => (el.id === selectedElement.id ? { ...el, type: val } : el))
                          }
                        : t
                    );
                    setDraft({ ...draft, tabs: updatedTabs });
                  }}
                >
                  <option value="toggle">Toggle (Switch)</option>
                  <option value="action">Action Button</option>
                  <option value="info">Info Text / Badge</option>
                  <option value="card">Card Box</option>
                  <option value="separator">Separator</option>
                </select>
              </label>

              <label style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedElement.enabled}
                  onChange={(e) => {
                    const val = e.target.checked;
                    const updatedTabs = draft.tabs.map((t) =>
                      t.id === selectedTabId
                        ? {
                            ...t,
                            elements: t.elements.map((el) => (el.id === selectedElement.id ? { ...el, enabled: val } : el))
                          }
                        : t
                    );
                    setDraft({ ...draft, tabs: updatedTabs });
                  }}
                  style={{ width: '18px', height: '18px' }}
                />
                Initial Enabled State
              </label>

              <button className="btn btn-danger" onClick={() => handleDeleteElement(selectedElement.id)} style={{ marginTop: '10px' }}>
                Remove Function
              </button>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
              Select any function in the configuration panel to edit its properties.
            </div>
          )}
        </div>
      </div>

      {/* Tab Modal */}
      {showTabModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <span className="modal-title">{editingTab ? 'Edit Tab' : 'Create New Tab'}</span>
              <button className="close-btn" onClick={() => setShowTabModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveTab} className="modal-form">
              <label>
                Tab Name
                <input
                  type="text"
                  required
                  placeholder="e.g. Optimizer, Mods"
                  value={tabModalName}
                  onChange={(e) => setTabModalName(e.target.value)}
                />
              </label>
              <label>
                Tab Icon (Emoji)
                <input
                  type="text"
                  required
                  value={tabModalIcon}
                  onChange={(e) => setTabModalIcon(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTabModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingTab ? 'Save Changes' : 'Create Tab'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Element Modal */}
      {showElementModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <span className="modal-title">{editingElement ? 'Edit Function' : 'Add Function / Element'}</span>
              <button className="close-btn" onClick={() => setShowElementModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveElement} className="modal-form">
              <label>
                Function Name / Title
                <input
                  type="text"
                  required
                  placeholder="e.g. Anti-Lag Booster"
                  value={elemModalName}
                  onChange={(e) => setElemModalName(e.target.value)}
                />
              </label>
              <label>
                Description
                <input
                  type="text"
                  placeholder="e.g. Optimize GPU rendering priority"
                  value={elemModalDesc}
                  onChange={(e) => setElemModalDesc(e.target.value)}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Icon (Emoji)
                  <input
                    type="text"
                    required
                    value={elemModalIcon}
                    onChange={(e) => setElemModalIcon(e.target.value)}
                  />
                </label>
                <label>
                  Element Type
                  <select
                    value={elemModalType}
                    onChange={(e) => setElemModalType(e.target.value as any)}
                  >
                    <option value="toggle">Toggle (Switch)</option>
                    <option value="action">Action Button</option>
                    <option value="info">Info Text / Badge</option>
                    <option value="card">Card Box</option>
                    <option value="separator">Separator</option>
                  </select>
                </label>
              </div>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={elemModalEnabled}
                  onChange={(e) => setElemModalEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                Initial Enabled State
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowElementModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingElement ? 'Save Changes' : 'Add Function'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
