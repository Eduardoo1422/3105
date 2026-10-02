import { useState } from 'react';
import type { FormEvent } from 'react';
import { login, saveSession } from '../services/api';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setError('');
    setLoading(true);

    try {
      const session = await login(username, password);

      saveSession(session);
      onLogin();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível entrar.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand">
          <div className="brand-mark">Z</div>
          <h1>ZROK</h1>
          <p>Painel administrativo</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            Usuário
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Digite seu usuário"
              autoComplete="username"
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
