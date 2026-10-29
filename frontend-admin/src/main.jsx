import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import DevicePreview from '../../shared/DevicePreview';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DevicePreview>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
        <Toaster position="top-right" toastOptions={{
          style: { background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-2)' },
        }} />
      </BrowserRouter>
    </DevicePreview>
  </React.StrictMode>
);

// Notifications push de la console (litiges, pannes, versements) : service worker sans cache
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
