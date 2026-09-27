import React, { useState } from 'react';
import { createLicense } from '../../services/api';

interface LicenseKeysViewProps {
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export default function LicenseKeysView({ onNotify }: LicenseKeysViewProps) {
  const [days, setDays] = useState(30);
  const [maxDevices, setMaxDevices] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ keyIdentifier: string; rawSecret: string } | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setCreatedResult(null);
    try {
      const result = await createLicense({ days: Number(days), maxDevices: Number(maxDevices), notes });
      setCreatedResult(result);
      onNotify('License key created successfully!');
    } catch (err: any) {
      onNotify(err.message || 'Failed to create license key', 'error');
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    onNotify('Copied to clipboard!');
  }

  return (
    <div className="content-body">
      <div className="card" style={{ maxWidth: '600px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Generate New License Key</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Create a new license key with configurable validity duration and maximum device limit. Validity begins upon first activation.
        </p>

        <form onSubmit={handleCreate} className="modal-form">
          <label>
            Duration (Days)
            <input
              type="number"
              min="1"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              required
            />
          </label>

          <label>
            Max Devices
            <input
              type="number"
              min="1"
              value={maxDevices}
              onChange={(e) => setMaxDevices(Number(e.target.value))}
              required
            />
          </label>

          <label>
            Notes / Client Reference
            <input
              type="text"
              placeholder="e.g. VIP Customer John Doe"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Generating...' : 'Generate License Key'}
          </button>
        </form>

        {createdResult && (
          <div style={{ marginTop: '24px', background: 'var(--bg-input)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--success)', marginBottom: '12px' }}>License Created Successfully</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Key Identifier:</span>
                <div className="code-box">
                  <span>{createdResult.keyIdentifier}</span>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => copyToClipboard(createdResult.keyIdentifier)}>Copy</button>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Raw Secret (Save this securely, shown only once):</span>
                <div className="code-box">
                  <span>{createdResult.rawSecret}</span>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => copyToClipboard(createdResult.rawSecret)}>Copy</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
