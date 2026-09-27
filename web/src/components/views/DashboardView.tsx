import { useEffect, useState } from 'react';
import { getCategories, getResources, getBootstrap } from '../../services/api';
import type { Category, Feature, Resource } from '../../types';

interface DashboardViewProps {
  onNavigate: (tab: any) => void;
}

export default function DashboardView({ onNavigate }: DashboardViewProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [catData, bootData, resData] = await Promise.all([
          getCategories().catch(() => []),
          getBootstrap().catch(() => ({ features: [] })),
          getResources().catch(() => ({ resources: [] })),
        ]);
        setCategories(catData);
        setFeatures(bootData.features || []);
        setResources(resData.resources || []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="content-body">
      <div className="grid-4">
        <div className="card" onClick={() => onNavigate('resources')} style={{ cursor: 'pointer' }}>
          <div className="card-title">Total Resources</div>
          <div className="card-value">{loading ? '...' : resources.length}</div>
          <div className="card-desc">Active target file packages</div>
        </div>
        <div className="card" onClick={() => onNavigate('features')} style={{ cursor: 'pointer' }}>
          <div className="card-title">App Features</div>
          <div className="card-value">{loading ? '...' : features.length}</div>
          <div className="card-desc">Configured features in iOS app</div>
        </div>
        <div className="card" onClick={() => onNavigate('categories')} style={{ cursor: 'pointer' }}>
          <div className="card-title">Categories</div>
          <div className="card-value">{loading ? '...' : categories.length}</div>
          <div className="card-desc">Feature grouping sections</div>
        </div>
        <div className="card" onClick={() => onNavigate('licenses')} style={{ cursor: 'pointer' }}>
          <div className="card-title">License Keys</div>
          <div className="card-value">Manage</div>
          <div className="card-desc">Generate & control access keys</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header-row">
          <div className="table-title">Recent Resources</div>
          <button className="btn btn-secondary" onClick={() => onNavigate('resources')}>View All</button>
        </div>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading system overview...</div>
        ) : resources.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No resources registered yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Filename</th>
                <th>Feature</th>
                <th>Bundle ID</th>
                <th>Target Path</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {resources.slice(0, 5).map((res) => (
                <tr key={res.id}>
                  <td><code>{res.filename}</code></td>
                  <td>{res.feature?.name || 'Unknown'}</td>
                  <td><code>{res.targetBundleId}</code></td>
                  <td><code>{res.targetRelativePath}</code></td>
                  <td>{Math.round(res.fileSize / 1024)} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
