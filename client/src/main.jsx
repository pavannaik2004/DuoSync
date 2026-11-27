import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/base.css';
import './styles/game.css';
// UI-2: each theme only overrides tokens under [data-theme='<key>'] (D100).
import './styles/themes/cyber.css';
import './styles/themes/noir.css';
import './styles/themes/orbital.css';
import './styles/themes/pirate.css';
import './styles/themes/haunted.css';
import './styles/themes/tomb.css';
import './styles/themes/arcane.css';
import './styles/themes/polar.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
