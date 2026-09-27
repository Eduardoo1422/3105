import React, { useEffect, useState } from 'react';
import { getCategories, createCategory } from '../../services/api';
import type { Category } from '../../types';

interface CategoriesViewProps {
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export default function CategoriesView({ onNotify }: CategoriesViewProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadCategories() {
    setLoading(true);
    try {
      const data = await getCategories();
      setCategories(data || []);
    } catch (err: any) {
      onNotify(err.message || 'Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createCategory({ name, slug, enabled });
      onNotify('Category created successfully!');
      setShowModal(false);
      setName('');
      setSlug('');
      setEnabled(true);
      loadCategories();
    } catch (err: any) {
      onNotify(err.message || 'Failed to create category', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="content-body">
      <div className="table-container">
        <div className="table-header-row">
          <div className="table-title">Feature Categories</div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Category</button>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading categories...</div>
        ) : categories.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No categories found.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td style={{ fontWeight: 600 }}>{cat.name}</td>
                  <td><code>{cat.slug}</code></td>
                  <td>
                    <span className={`badge ${cat.enabled ? 'badge-active' : 'badge-inactive'}`}>
                      {cat.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>{new Date(cat.createdAt).toLocaleDateString()}</td>
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
              <div className="modal-title">Create New Category</div>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate} className="modal-form">
              <label>
                Category Name
                <input
                  type="text"
                  placeholder="e.g. Aimbot Functions"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                  }}
                  required
                />
              </label>

              <label>
                Slug (URL friendly identifier)
                <input
                  type="text"
                  placeholder="e.g. aimbot-functions"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
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
                  {submitting ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
