import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import type { ClienteEnLinea } from '../enlinea/cliente';
import type { DirectorVivo } from '../juego/director-vivo';

export type Pantalla = 'inicio' | 'configurar' | 'mesa' | 'reglas' | 'enLinea' | 'sala';
export type Tema = 'sistema' | 'claro' | 'oscuro';

const CLAVE_TEMA = 'hts:tema';
const CLAVE_ANIMACIONES = 'hts:reducirAnimaciones';

/** Preferencia de animaciones guardada: true/false, o null para seguir la del sistema. */
function animacionesGuardadas(): boolean | null {
  try {
    const v = localStorage.getItem(CLAVE_ANIMACIONES);
    return v === 'si' ? true : v === 'no' ? false : null;
  } catch {
    return null;
  }
}

const CONSULTA_MOVIMIENTO = '(prefers-reduced-motion: reduce)';

function consultaMovimiento(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(CONSULTA_MOVIMIENTO)
    : null;
}

/** El sistema pide reducir el movimiento (prefers-reduced-motion), y se actualiza si cambia. */
function useSistemaReduceMovimiento(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = consultaMovimiento();
      consulta?.addEventListener('change', avisar);
      return () => consulta?.removeEventListener('change', avisar);
    },
    () => consultaMovimiento()?.matches ?? false,
  );
}

function temaGuardado(): Tema {
  try {
    const t = localStorage.getItem(CLAVE_TEMA);
    return t === 'claro' || t === 'oscuro' ? t : 'sistema';
  } catch {
    return 'sistema';
  }
}

interface EstadoApp {
  pantalla: Pantalla;
  /** Pantalla a la que volver desde las reglas. */
  anterior: Pantalla;
  tema: Tema;
  /** Reducir animaciones: true/false elegido en Ajustes, o null para seguir al sistema. */
  reducirAnimaciones: boolean | null;
  tutorial: boolean;
  director: DirectorVivo | null;
  /** Conexión con el servidor (pantallas en línea). */
  cliente: ClienteEnLinea | null;
  irA: (p: Pantalla) => void;
  volver: () => void;
  cambiarTema: (t: Tema) => void;
  cambiarReducirAnimaciones: (reducir: boolean) => void;
  mostrarTutorial: (visible: boolean) => void;
  empezar: (d: DirectorVivo) => void;
  salir: () => void;
  abrirEnLinea: (cliente: ClienteEnLinea, pantalla: 'enLinea' | 'sala') => void;
  cerrarEnLinea: () => void;
}

export const useApp = create<EstadoApp>()((set, get) => ({
  pantalla: 'inicio',
  anterior: 'inicio',
  tema: temaGuardado(),
  reducirAnimaciones: animacionesGuardadas(),
  tutorial: false,
  director: null,
  cliente: null,
  irA: (p) => set({ pantalla: p, anterior: get().pantalla }),
  volver: () => set({ pantalla: get().anterior }),
  cambiarTema: (tema) => {
    try {
      localStorage.setItem(CLAVE_TEMA, tema);
    } catch {
      // Sin almacenamiento: el tema solo dura esta sesión.
    }
    set({ tema });
  },
  cambiarReducirAnimaciones: (reducir) => {
    try {
      localStorage.setItem(CLAVE_ANIMACIONES, reducir ? 'si' : 'no');
    } catch {
      // Sin almacenamiento: la preferencia solo dura esta sesión.
    }
    set({ reducirAnimaciones: reducir });
  },
  mostrarTutorial: (tutorial) => set({ tutorial }),
  empezar: (director) => {
    get().director?.destruir();
    set({ director, pantalla: 'mesa', anterior: 'inicio' });
  },
  salir: () => {
    get().director?.destruir();
    set({ director: null, pantalla: 'inicio', anterior: 'inicio' });
  },
  abrirEnLinea: (cliente, pantalla) => {
    const previo = get().cliente;
    if (previo !== null && previo !== cliente) previo.cerrar();
    set({ cliente, pantalla, anterior: 'inicio' });
  },
  cerrarEnLinea: () => {
    get().cliente?.cerrar();
    set({ cliente: null, pantalla: 'inicio', anterior: 'inicio' });
  },
}));

/** ¿Hay que reducir las animaciones? (lo elegido en Ajustes o, si no, lo que pide el sistema). */
export function useReducirAnimaciones(): boolean {
  const elegido = useApp((s) => s.reducirAnimaciones);
  const sistema = useSistemaReduceMovimiento();
  return elegido ?? sistema;
}
