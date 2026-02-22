import React, { useState } from 'react';
import { apiUrl } from '../api';

export default function Login({ onLogin }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isRegister ? apiUrl('/api/register') : apiUrl('/api/login');
      const body = isRegister
        ? { username: fullName, password, fullName, phone }
        : { username: fullName, password };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      onLogin(data.user, data.token);
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">💬</div>
          <h1>HereToChat</h1>
          <p>{isRegister ? 'Créer un compte' : 'Se connecter'}</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Ton nom"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
            autoFocus
          />
          {isRegister && (
            <input
              type="tel"
              placeholder="Numéro de téléphone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
            />
          )}
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? '...' : isRegister ? "S'inscrire" : 'Se connecter'}
          </button>
        </form>
        <p className="switch-mode" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
          {isRegister ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire"}
        </p>
      </div>
    </div>
  );
}
