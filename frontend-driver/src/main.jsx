import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import DevicePreview from '../../shared/DevicePreview';
// Splash propre au camionneur : animation de tracé du logo (le client garde le camion)
import SplashGate from './components/DriverSplash';
import './index.css';
import { initLanguage } from '../../shared/i18n/dom';

// Langue de l'appareil (réglages > langue) : les textes affichés sont traduits à la volée
initLanguage();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DevicePreview>
      <BrowserRouter>
        <ErrorBoundary>
          <SplashGate>
            <App />
          </SplashGate>
        </ErrorBoundary>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--surface)',
              color: 'var(--text-strong)',
              border: '1px solid rgba(17, 24, 39, 0.1)',
            },
          }}
        />
      </BrowserRouter>
    </DevicePreview>
  </React.StrictMode>
);

if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Application, pas page web : pas de zoom au pincement sur iOS (Safari ignore user-scalable=no).
// Les cartes Leaflet gèrent leur zoom avec leurs propres événements tactiles.
document.addEventListener('gesturestart', (e) => e.preventDefault());
