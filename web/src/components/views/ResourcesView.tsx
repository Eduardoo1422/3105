import React, { useEffect, useState } from 'react';
import { getResources, getBootstrap, uploadResource, downloadResourceFile } from '../../services/api';
import type { Feature, Resource } from '../../types';

interface ResourcesViewProps {
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export default function ResourcesView({ onNotify }: ResourcesViewProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [featureId, setFeatureId] = useState('');
  const [targetBundleId, setTargetBundleId] = useState('com.example.game');
  const [targetRelativePath, setTargetRelativePath] = useState('Documents/Data');
  const [targetFilename, setTargetFilename] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [resData, bootData] = await Promise.all([
        getResources(),
        getBootstrap(),
      ]);
      setResources(resData.resources || []);
      setFeatures(bootData.features || []);
      if (bootData.features && bootData.features.length > 0) {
        setFeatureId(bootData.features[0].id);
      }
    } catch (err: any) {
      onNotify(err.message || 'Failed to load resources', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      onNotify('Please select a file to upload', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('featureId', featureId);
      formData.append('targetBundleId', targetBundleId);
      formData.append('targetRelativePath', targetRelativePath);
      if (targetFilename) {
        formData.append('targetFilename', targetFilename);
      }
      formData.append('file', file);

      await uploadResource(formData);
      onNotify('Resource uploaded successfully!');
      setShowModal(false);
      setFile(null);
      setTargetFilename('');
      loadData();
    } catch (err: any) {
      onNotify(err.message || 'Failed to upload resource', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload(res: Resource) {
    try {
      await downloadResourceFile(res.id, res.targetFilename || res.filename);
      onNotify('Download started');
    } catch (err: any) {
      onNotify(err.message || 'Download failed', 'error');
    }
  }

  return (
    <div className="content-body">
      <div className="table-container">
        <div className="table-header-row">
          <div className="table-title">Replacement Resources & Files</div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Upload Resource</button>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading resources...</div>
        ) : resources.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No resources uploaded yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Original Filename</th>
                <th>Feature</th>
                <th>Target Bundle ID</th>
                <th>Target Path / Filename</th>
                <th>Size</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((res) => (
                <tr key={res.id}>
                  <td><code>{res.filename}</code></td>
                  <td>{res.feature?.name || 'Unknown'}</td>
                  <td><code>{res.targetBundleId}</code></td>
                  <td><code>{res.targetRelativePath}/{res.targetFilename}</code></td>
                  <td>{Math.round(res.fileSize / 1024)} KB</td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleDownload(res)}>
                      Download
                    </button>
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
              <div className="modal-title">Upload Replacement Resource</div>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleUpload} className="modal-form">
              <label>
                Associated Feature
                <select value={featureId} onChange={(e) => setFeatureId(e.target.value)} required>
                  {features.map((feat) => (
                    <option key={feat.id} value={feat.id}>{feat.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Target Bundle ID
                <input
                  type="text"
                  placeholder="e.g. com.tencent.ig"
                  value={targetBundleId}
                  onChange={(e) => setTargetBundleId(e.target.value)}
                  required
                />
              </label>

              <label>
                Target Relative Path (No '..' or leading '/')
                <input
                  type="text"
                  placeholder="e.g. Documents/UserData"
                  value={targetRelativePath}
                  onChange={(e) => setTargetRelativePath(e.target.value)}
                  required
                />
              </label>

              <label>
                Target Filename (Destination name inside bundle)
                <input
                  type="text"
                  placeholder="e.g. config.dat (optional)"
                  value={targetFilename}
                  onChange={(e) => setTargetFilename(e.target.value)}
                />
              </label>

              <label>
                Select File
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Uploading...' : 'Upload Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
