import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/auth.css';

/** Cadre commun à la connexion et à l'inscription : en-tête sombre, puis carte blanche à onglets. */
export default function AuthShell({ title, subtitle, tab, children }) {
  return (
    <main className="bn-login">
      <header className="bn-login__hero">
        <p className="bn-login__brand">
          <img src="/logo-icon.png" alt="" width="36" height="36" />
          <span>Benne<em>Go</em></span>
        </p>
        <h1 className="bn-login__title">{title}</h1>
        <p className="bn-login__subtitle">{subtitle}</p>
      </header>

      <section className="bn-login__card">
        <nav className="bn-login__tabs" aria-label="Connexion ou inscription">
          <Link to="/login" className={`bn-login__tab${tab === 'login' ? ' is-active' : ''}`} aria-current={tab === 'login' ? 'page' : undefined}>
            Connexion
          </Link>
          <Link to="/register" className={`bn-login__tab${tab === 'register' ? ' is-active' : ''}`} aria-current={tab === 'register' ? 'page' : undefined}>
            Inscription
          </Link>
        </nav>
        {children}
      </section>
    </main>
  );
}
