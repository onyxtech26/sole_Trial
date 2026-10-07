import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

// Clear the pre-bundle brand hold painted by index.html.
root.innerHTML = '';

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
