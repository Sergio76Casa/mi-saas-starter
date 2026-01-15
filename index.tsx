
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';

const rootElement = document.getElementById('root');

// Captura de errores de promesas no manejadas para diagnóstico
window.onunhandledrejection = (event) => {
  console.error('Unhandled promise rejection:', event.reason);
};

if (!rootElement) {
  const errorMsg = "Could not find root element to mount to";
  console.error(errorMsg);
  document.body.innerHTML = `<div style="padding: 40px; color: red; font-family: sans-serif;"><h1>Fatal Error</h1><p>${errorMsg}</p></div>`;
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </React.StrictMode>
    );
  } catch (err: any) {
    console.error("React Mounting Error:", err);
    rootElement.innerHTML = `
      <div style="padding: 40px; color: #1e293b; font-family: sans-serif; background: #fef2f2; min-height: 100vh; border: 4px solid #ef4444;">
        <h1 style="font-weight: 900; text-transform: uppercase; letter-spacing: -0.05em; font-style: italic; color: #dc2626;">Failed to load the app</h1>
        <p style="color: #64748b; font-weight: 500; font-style: italic; margin-bottom: 20px;">The application crashed during initialization. Please check the error details below for debugging.</p>
        
        <div style="background: #ffffff; padding: 25px; border-radius: 15px; border: 1px solid #fee2e2; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          <div style="color: #ef4444; font-weight: 900; text-transform: uppercase; font-size: 12px; margin-bottom: 10px;">Error Message:</div>
          <div style="color: #111827; font-weight: bold; font-family: monospace; margin-bottom: 20px;">${err?.message || 'Unknown Error'}</div>
          
          <div style="color: #ef4444; font-weight: 900; text-transform: uppercase; font-size: 12px; margin-bottom: 10px;">Stack Trace:</div>
          <pre style="background: #f8fafc; padding: 15px; border-radius: 10px; color: #475569; font-size: 11px; overflow: auto; max-height: 400px; border: 1px solid #e2e8f0;">${err?.stack || 'No stack trace available'}</pre>
        </div>
        
        <div style="margin-top: 30px; display: flex; gap: 15px;">
          <button onclick="window.location.reload()" style="padding: 12px 24px; background: #dc2626; color: white; border: none; border-radius: 12px; font-weight: 900; cursor: pointer; text-transform: uppercase; letter-spacing: 0.1em; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2);">Try Reloading</button>
          <button onclick="localStorage.clear(); window.location.reload();" style="padding: 12px 24px; background: #ffffff; color: #ef4444; border: 1px solid #ef4444; border-radius: 12px; font-weight: 900; cursor: pointer; text-transform: uppercase; letter-spacing: 0.1em;">Clear Cache & Reload</button>
        </div>
      </div>
    `;
  }
}
