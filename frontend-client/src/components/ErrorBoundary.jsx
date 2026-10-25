import React from 'react';

/**
 * Empêche qu'une erreur de rendu ne laisse une page blanche : l'utilisateur voit un message
 * et peut recharger. L'erreur est transmise à la console pour le diagnostic.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Erreur d\'affichage BenneGo :', error, info?.componentStack);
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="bn-auth" role="alert">
        <section className="bn-card bn-auth__card">
          <h1 className="bn-auth__title">Une erreur est survenue</h1>
          <p className="bn-subtitle">
            Cette page n'a pas pu s'afficher. Rechargez-la ; si le problème persiste, réessayez plus tard.
          </p>
          <button type="button" onClick={this.handleReload} className="bn-btn bn-btn--primary bn-btn--block">
            Recharger la page
          </button>
        </section>
      </main>
    );
  }
}
