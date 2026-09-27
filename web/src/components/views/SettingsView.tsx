import type { AuthUser } from '../../types';

interface SettingsViewProps {
  user: AuthUser | null;
}

export default function SettingsView({ user }: SettingsViewProps) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

  return (
    <div className="content-body">
      <div className="card" style={{ maxWidth: '600px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>System Configuration</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Environment and connectivity parameters for the SWAG-EXTERNAL administrative panel.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Connected API Endpoint:</span>
            <div className="code-box">
              <span>{apiUrl}</span>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Administrator:</span>
            <div className="code-box">
              <span>{user?.username} ({user?.role})</span>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Deployment Target:</span>
            <div className="code-box">
              <span>Vercel (Frontend) → Render (Backend) → Supabase (Database)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
