import React, { useEffect, useState } from 'react';
import { getBootstrap, getCategories, createFeature } from '../../services/api';
import type { Category, Feature } from '../../types';

interface FeaturesViewProps {
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export default function FeaturesView({ onNotify }: FeaturesViewProps) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [iconName, setIconName] = useState('sparkles');
  const [enabled, setEnabled] = useState(true);
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
      if (catData && catData.length > 0) {
        setCategoryId(catData[0].id);
      }
    } catch (err: any) {
      onNotify(err.message || 'Failed to load features', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createFeature({ name, description, categoryId, iconName, enabled });
      onNotify('Feature created successfully!');
      setShowModal(false);
      setName('');
      setDescription('');
      setIconName('sparkles');
      setEnabled(true);
      loadData();
    } catch (err: any) {
      onNotify(err.message || 'Failed to create feature', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="content-body">
      <div className="table-container">
        <div className="table-header-row">
          <div className="table-title">Application Features</div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Feature</button>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading features...</div>
        ) : features.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No features found.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Feature Name</th>
                <th>Description</th>
                <th>Category</th>
                <th>Icon</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feat) => (
                <tr key={feat.id}>
                  <td style={{ fontWeight: 600 }}>{feat.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{feat.description}</td>
                  <td>{feat.category?.name || 'Unassigned'}</td>
                  <td><code>{feat.iconName}</code></td>
                  <td>
                    <span className={`badge ${feat.enabled ? 'badge-active' : 'badge-inactive'}`}>
                      {feat.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create New Feature</div>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate} className="modal-form">
              <label>
                Feature Name
                <input
                  type="text"
                  placeholder="e.g. ESP Player Outline"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>

              <label>
                Description
                <textarea
                  placeholder="Short description of the feature..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  required
                />
              </label>

              <label>
                Category
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Icon Name
                <input
                  type="text"
                  placeholder="e.g. sparkles"
                  value={iconName}
                  onChange={(e) => setIconName(e.target.value)}
                  required
                />
              </label>

              <label style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Enabled
              </label>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Feature'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
