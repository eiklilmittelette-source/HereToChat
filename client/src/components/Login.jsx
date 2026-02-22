import React, { useState } from 'react';
import { apiUrl } from '../api';

export default function Login({ onLogin }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [profilePic, setProfilePic] = useState('');
  const hasInvite = new URLSearchParams(window.location.search).has('invite');

  function handlePicChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfilePic(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const invitedBy = new URLSearchParams(window.location.search).get('invite');
    try {
      if (isRegister) {
        if (!fullName.trim()) { setError('Nom requis'); setLoading(false); return; }
        if (!phone.trim()) { setError('Numéro requis'); setLoading(false); return; }
        const res = await fetch(apiUrl('/api/register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: phone.trim(), password, fullName: fullName.trim(), phone: phone.trim(), profilePic: profilePic || undefined, invitedBy: invitedBy || undefined })
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); return; }
        onLogin(data.user, data.token);
      } else {
        // Login with phone number
        const res = await fetch(apiUrl('/api/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone.trim(), password })
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); return; }
        onLogin(data.user, data.token);
      }
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
          {hasInvite && <p style={{ color: '#2ecc71', fontSize: 13, marginTop: 6 }}>Un ami t'a invité ! Inscris-toi pour le retrouver</p>}
        </div>
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <label className="profile-pic-upload" style={{ display: 'flex', margin: '0 auto 14px' }}>
                <input type="file" accept="image/*" onChange={handlePicChange} style={{ display: 'none' }} />
                {profilePic ? (
                  <img src={profilePic} alt="" className="profile-pic-preview" />
                ) : (
                  <div className="profile-pic-placeholder">
                    📷
                    <span className="profile-pic-text">Photo</span>
                  </div>
                )}
              </label>
              <input
                type="text"
                placeholder="Ton nom complet"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </>
          )}
          <input
            type="tel"
            placeholder="Numéro de téléphone"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
            autoFocus
          />
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
