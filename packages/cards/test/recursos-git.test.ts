import { describe, expect, it } from 'vitest';
import {
  cabeceraAutorizacion,
  limpiarSalida,
  ocultarCredenciales,
  ordenClon,
} from '../src/recursos-git';

const REPO = 'https://github.com/dbermudeza/here-to-slay-recursos.git';
const TOKEN = 'github_pat_SECRETO123';

describe('ocultarCredenciales', () => {
  it('oculta usuario y contraseña de una URL', () => {
    expect(ocultarCredenciales('https://usuario:secreto@github.com/a/b.git')).toBe(
      'https://***@github.com/a/b.git',
    );
  });
  it('oculta un token solo, sin usuario', () => {
    expect(ocultarCredenciales(`https://${TOKEN}@github.com/a/b.git`)).toBe(
      'https://***@github.com/a/b.git',
    );
  });
  it('oculta todas las URL de un mensaje de error de git', () => {
    const msg =
      "fatal: unable to access 'https://x:y@github.com/a.git/': error\nremote: http://z@h/b";
    const limpio = ocultarCredenciales(msg);
    expect(limpio).toBe(
      "fatal: unable to access 'https://***@github.com/a.git/': error\nremote: http://***@h/b",
    );
  });
  it('no cambia URL sin credenciales ni direcciones ssh sin esquema', () => {
    expect(ocultarCredenciales(REPO)).toBe(REPO);
    expect(ocultarCredenciales('git@github.com:a/b.git')).toBe('git@github.com:a/b.git');
  });
});

describe('limpiarSalida', () => {
  it('oculta además el token y la cabecera aunque aparezcan fuera de una URL', () => {
    const cab = cabeceraAutorizacion(TOKEN);
    const texto = `token ${TOKEN} y cabecera ${cab}`;
    const limpio = limpiarSalida(texto, [TOKEN, cab]);
    expect(limpio).not.toContain(TOKEN);
    expect(limpio).not.toContain(cab.slice('Authorization: Basic '.length));
  });
});

describe('ordenClon', () => {
  it('sin token: argumentos normales y sin preguntas interactivas', () => {
    const { args, env } = ordenClon(REPO, '/tmp/x', undefined, { PATH: '/bin' });
    expect(args).toEqual(['clone', '--depth', '1', '--quiet', REPO, '/tmp/x']);
    expect(env['GIT_TERMINAL_PROMPT']).toBe('0');
    expect(env['GIT_CONFIG_COUNT']).toBeUndefined();
    expect(env['PATH']).toBe('/bin');
  });

  it('con token: va en el entorno del hijo como cabecera, nunca en los argumentos', () => {
    const { args, env } = ordenClon(REPO, '/tmp/x', TOKEN, {});
    const cab = cabeceraAutorizacion(TOKEN);
    const base64 = cab.slice('Authorization: Basic '.length);
    for (const a of args) {
      expect(a).not.toContain(TOKEN);
      expect(a).not.toContain(base64);
    }
    expect(args).toContain(REPO);
    expect(env['GIT_CONFIG_COUNT']).toBe('1');
    expect(env['GIT_CONFIG_KEY_0']).toBe('http.https://github.com/.extraHeader');
    expect(env['GIT_CONFIG_VALUE_0']).toBe(cab);
    expect(Buffer.from(base64, 'base64').toString('utf8')).toBe(`x-access-token:${TOKEN}`);
  });

  it('con token: respeta una configuración GIT_CONFIG_* previa', () => {
    const base = {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.autocrlf',
      GIT_CONFIG_VALUE_0: 'false',
    };
    const { env } = ordenClon(REPO, '/tmp/x', TOKEN, base);
    expect(env['GIT_CONFIG_COUNT']).toBe('2');
    expect(env['GIT_CONFIG_KEY_0']).toBe('core.autocrlf');
    expect(env['GIT_CONFIG_KEY_1']).toBe('http.https://github.com/.extraHeader');
    expect(base.GIT_CONFIG_COUNT).toBe('1');
  });

  it('con token: no admite repositorios que no sean http(s)', () => {
    expect(() => ordenClon('git@github.com:a/b.git', '/tmp/x', TOKEN, {})).toThrow(/https/);
  });
});
