import React, { useEffect, useState } from 'react';
import { getBootstrap, getCategories, createFeature, updateFeature, deleteFeature, uploadResource } from '../../services/api';
import type { Category, Feature } from '../../types';

interface PatchesViewProps {
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export default function PatchesView({ onNotify }: PatchesViewProps) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [iconName, setIconName] = useState('scope');
  const [status, setStatus] = useState<'GREEN' | 'YELLOW' | 'RED'>('GREEN');
  const [targetBundleId, setTargetBundleId] = useState('com.apple.mobile.MobileHouseArrest');
  const [targetRelativePath, setTargetRelativePath] = useState('Documents/patch.plist');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [bootData, catData] = await Promise.all([
        getBootstrap(),
        getCategories(),
      ]);
      setFeatures(bootData.features || []);
      setCategories(catData || []);
      if (catData && catData.length > 0 && !categoryId) {
        setCategoryId(catData[0].id);
      }
    } catch (err: any) {
      onNotify(err.message || 'Failed to load patches', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingFeature(null);
    setName('');
    setDescription('');
    setIconName('scope');
    setStatus('GREEN');
    setFile(null);
    if (categories.length > 0) setCategoryId(categories[0].id);
    setShowModal(true);
  }

  function openEditModal(feat: Feature) {
    setEditingFeature(feat);
    setName(feat.name);
    setDescription(feat.description);
    setCategoryId(feat.categoryId);
    setIconName(feat.iconName);
    setStatus((feat.status as any) || 'GREEN');
    setFile(null);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingFeature) {
        // Edit existing feature
        await updateFeature(editingFeature.id, {
          name,
          description,
          categoryId,
          iconName,
          status,
        });
        if (file) {
          const formData = new FormData();
          formData.append('featureId', editingFeature.id);
          formData.append('targetBundleId', targetBundleId);
          formData.append('targetRelativePath', targetRelativePath);
          formData.append('file', file);
          await uploadResource(formData);
        }
        onNotify('Patch updated successfully!');
      } else {
        // Create new feature
        if (!file) {
          onNotify('Please select a .3105 patch file to upload.', 'error');
          setSubmitting(false);
          return;
        }
        const feature = await createFeature({
          name,
          description,
          categoryId,
          iconName,
          enabled: true,
          status,
        });

        const formData = new FormData();
        formData.append('featureId', feature.id);
        formData.append('targetBundleId', targetBundleId);
        formData.append('targetRelativePath', targetRelativePath);
        formData.append('file', file);

        await uploadResource(formData);
        onNotify('Patch created and .3105 file uploaded successfully!');
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      onNotify(err.message || 'Operation failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, featName: string) {
    if (!window.confirm(`Are you sure you want to delete patch "${featName}"?`)) return;
    try {
      await deleteFeature(id);
      onNotify('Patch deleted successfully.');
      loadData();
    } catch (err: any) {
      onNotify(err.message || 'Failed to delete patch', 'error');
    }
  }

  function getStatusBadge(st: string = 'GREEN') {
    switch (st) {
      case 'GREEN':
        return <span className="badge badge-active" style={{ background: '#10b98120', color: '#10b981', border: '1px solid #10b98150' }}>🟢 Available (Green)</span>;
      case 'YELLOW':
        return <span className="badge" style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b50' }}>🟡 Maintenance (Yellow)</span>;
      case 'RED':
        return <span className="badge badge-inactive" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444450' }}>🔴 Offline (Red)</span>;
      default:
        return <span className="badge">🟢 Available</span>;
    }
  }

  return (
    <div className="content-body">
      <div className="table-container">
        <div className="table-header-row">
          <div>
            <div className="table-title">Zrok Patches & Features Manager</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Manage Zrok patches, .3105 files, and real-time operational status (Green / Yellow / Red).
            </div>
          </div>
          <button className="btn btn-primary" onClick={openCreateModal}>+ Add New Patch</button>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading patches...</div>
        ) : features.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No patches found. Add your first .3105 patch.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Patch Name</th>
                <th>Description</th>
                <th>Category</th>
                <th>Icon</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feat) => (
                <tr key={feat.id}>
                  <td style={{ fontWeight: 600 }}>{feat.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{feat.description}</td>
                  <td>{feat.category?.name || 'Unassigned'}</td>
                  <td><code>{feat.iconName}</code></td>
                  <td>{getStatusBadge(feat.status)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: '12px', marginRight: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)' }} onClick={() => openEditModal(feat)}>Edit</button>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: '12px', background: '#ef444420', color: '#ef4444', border: '1px solid #ef444450' }} onClick={() => handleDelete(feat.id, feat.name)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div className="modal-title">{editingFeature ? 'Edit Zrok Patch' : 'Add New Zrok Patch (.3105)'}</div>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSave} className="modal-form">
              <label>
                Patch Name
                <input
                  type="text"
                  placeholder="e.g. Aimbot High Precision"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>

              <label>
                Description
                <textarea
                  placeholder="Detailed description of what this patch does..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  required
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <label>
                  Category
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Operational Status
                  <select value={status} onChange={(e) => setStatus(e.target.value as any)} required>
                    <option value="GREEN">🟢 Available (Green)</option>
                    <option value="YELLOW">🟡 Maintenance (Yellow)</option>
                    <option value="RED">🔴 Offline (Red)</option>
                  </select>
                </label>
              </div>

              {!editingFeature && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <label>
                      Target Bundle ID
                      <input
                        type="text"
                        value={targetBundleId}
                        onChange={(e) => setTargetBundleId(e.target.value)}
                        required
                      />
                    </label>

                    <label>
                      Target Relative Path
                      <input
                        type="text"
                        value={targetRelativePath}
                        onChange={(e) => setTargetRelativePath(e.target.value)}
                        required
                      />
                    </label>
                  </div>
                </>
              )}

              <label>
                Icon Name (SF Symbol)
                <input
                  type="text"
                  value={iconName}
                  onChange={(e) => setIconName(e.target.value)}
                  placeholder="e.g. scope, sparkles, shield.fill"
                  required
                />
              </label>

              <label>
                {editingFeature ? 'Replace .3105 Patch File (Optional)' : '.3105 Patch File'}
                <input
                  type="file"
                  accept=".3105,application/octet-stream"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  {...(!editingFeature ? { required: true } : {})}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Must be a valid .3105 package starting with magic bytes <code>3105PATCH\0</code>.
                </span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : (editingFeature ? 'Update Patch' : 'Save & Upload Patch')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
