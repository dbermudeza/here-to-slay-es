import type { Carta } from '@hts/cards';
import type { Motor } from '@hts/engine';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { DirectorVivo } from '../juego/director-vivo';

interface ValorCatalogo {
  motor: Motor;
  cartas: readonly Carta[];
}

const CatalogoContexto = createContext<ValorCatalogo | null>(null);

export function ProveedorCatalogo({
  motor,
  cartas,
  children,
}: ValorCatalogo & { children: ReactNode }) {
  return (
    <CatalogoContexto.Provider value={{ motor, cartas }}>{children}</CatalogoContexto.Provider>
  );
}

export function useCatalogo(): ValorCatalogo {
  const v = useContext(CatalogoContexto);
  if (v === null) throw new Error('Falta ProveedorCatalogo');
  return v;
}

/** Datos de catálogo de una carta por id (o undefined). */
export function useCarta(id: string | null | undefined): Carta | undefined {
  const { motor } = useCatalogo();
  return id === null || id === undefined ? undefined : motor.catalogo.get(id);
}

/** Re-renderiza el componente cada vez que el director cambia. */
export function useDirector(director: DirectorVivo): number {
  return useSyncExternalStore(
    (fn) => director.suscribir(fn),
    () => director.version,
  );
}

/** Instante actual, refrescado cada `ms` mientras `activo` (para las cuentas regresivas). */
export function useAhora(activo: boolean, ms = 100): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return undefined;
    const id = window.setInterval(() => setAhora(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [activo, ms]);
  return ahora;
}
