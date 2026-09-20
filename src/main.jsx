import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import App from './App.jsx';
import './index.css';
import './environment.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// No-op on the web build — only a real iOS/Android shell reaches here.
if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  SplashScreen.hide();
} else if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Web only, and only in a real build: a worker in front of the dev server
  // would serve yesterday's modules back to you. The native shell already
  // ships its files locally and has nothing to cache.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // An unavailable worker (private mode, insecure origin) costs nothing
      // but offline support — the app itself is unaffected.
    });
  });
}
