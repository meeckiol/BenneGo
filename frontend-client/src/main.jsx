import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { MotionConfig } from 'motion/react';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import DevicePreview from '../../shared/DevicePreview';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DevicePreview>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
          <Toaster position="top-center" />
        </BrowserRouter>
      </MotionConfig>
    </DevicePreview>
  </React.StrictMode>
);

// Enregistré aussi en développement : Chrome Android n'installe l'application qu'avec un service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
