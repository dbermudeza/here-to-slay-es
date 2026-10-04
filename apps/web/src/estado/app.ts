import { create } from 'zustand';
import type { ClienteEnLinea } from '../enlinea/cliente';
import type { DirectorVivo } from '../juego/director-vivo';

export type Pantalla = 'inicio' | 'configurar' | 'mesa' | 'reglas' | 'enLinea' | 'sala';
export type Tema = 'sistema' | 'claro' | 'oscuro';

const CLAVE_TEMA = 'hts:tema';

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
  tutorial: boolean;
  director: DirectorVivo | null;
  /** Conexión con el servidor (pantallas en línea). */
  cliente: ClienteEnLinea | null;
  irA: (p: Pantalla) => void;
  volver: () => void;
  cambiarTema: (t: Tema) => void;
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
