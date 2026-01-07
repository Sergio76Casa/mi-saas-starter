
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  const errorMsg = "Could not find root element to mount to";
  console.error(errorMsg);
  document.body.innerHTML = `<div style="padding: 40px; color: red; font-family: sans-serif;"><h1>Fatal Error</h1><p>${errorMsg}</p></div>`;
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err: any) {
    console.error("React Mounting Error:", err);
    rootElement.innerHTML = `
      <div style="padding: 40px; color: #1e293b; font-family: sans-serif; background: #f8fafc; min-height: 100vh;">
        <h1 style="font-weight: 900; text-transform: uppercase; letter-spacing: -0.05em; font-style: italic;">Failed to load the app</h1>
        <p style="color: #64748b; font-weight: 500; font-style: italic;">The application crashed during initialization. Here is the error detail:</p>
        <pre style="background: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; color: #ef4444; font-weight: bold; overflow: auto;">${err?.message}\n\n${err?.stack}</pre>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 900; cursor: pointer; text-transform: uppercase; letter-spacing: 0.1em;">Try Reloading</button>
      </div>
    `;
  }
}
