import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './estilos.css';

// Solo en la compilación de pruebas e2e (en la normal esta rama y el piloto desaparecen).
if (import.meta.env.MODE === 'e2e') void import('./e2e/piloto');

const raiz = document.getElementById('raiz');
if (raiz === null) throw new Error('Falta el elemento #raiz');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
