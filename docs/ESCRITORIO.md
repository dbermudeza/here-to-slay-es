# Acceso directo de escritorio (`Here to Slay.url`)

**Resumen.** `pnpm empaquetar` genera `dist-app/HereToSlay/Here to Slay.url`, un **acceso directo de
internet de Windows**: al hacer doble clic, Windows abre en el navegador predeterminado el juego
desplegado en Render (`URL_EN_LINEA`, [DESPLIEGUE.md](DESPLIEGUE.md)). No arranca ningún servidor,
no pregunta nada y no muestra consola. Ocupa unos bytes, abre al instante y el antivirus no tiene
nada que analizar. Para jugar con un servidor en este equipo (misma Wi-Fi o sin internet) se usa
`pnpm servidor` ([EN_LINEA.md](EN_LINEA.md)).

Código: `apps/server/src/escritorio.ts` (`URL_EN_LINEA` y `contenidoAccesoDirecto`),
`apps/server/scripts/empaquetar.ts` (genera la carpeta) y `apps/server/scripts/icono.ts` (icono).
Tests: `apps/server/test/escritorio.test.ts` e `icono.test.ts`.

> Hasta el commit `8c68625` esto era `HereToSlay.exe`: una copia de Node de unos 90 MB (ejecutable
> único SEA) que solo abría el navegador. El acceso directo hace lo mismo sin el peso, sin la espera
> del antivirus la primera vez y sin el aviso de SmartScreen.

## Requisitos

- Haber instalado los recursos (`pnpm recursos`): el icono sale de `assets/cartas/logo.png`. Sin él
  el script avisa y el acceso directo lleva el icono del navegador.
- Pensado para Windows. En macOS y Linux el archivo `.url` se genera igual, pero esos sistemas no lo
  abren con doble clic de la misma forma.

## Qué hace `pnpm empaquetar`

El script raíz es `pnpm --filter @hts/server empaquetar` (no compila la web).

1. **Limpieza.** Borra y recrea `dist-app/HereToSlay/` (así desaparece también el `HereToSlay.exe`
   de versiones anteriores). Si no puede borrarla (por ejemplo, un `HereToSlay.exe` antiguo abierto),
   se detiene y lo dice.
2. **Icono.** `iconoDesdeLogo` (`scripts/icono.ts`) toma `assets/cartas/logo.png` (`IMAGEN_LOGO` de
   `@hts/cards`) y genera un PNG de 256 × 256 (`LADO_ICONO`): recorta el margen transparente
   (`cajaVisible`), lo escala con supermuestreo 3 × 3 y lo coloca sobre un cuadrado redondeado oscuro
   (el logo es texto claro con mucho margen y apenas se vería). `png-to-ico` lo guarda como
   `logo.ico` junto al acceso directo.
3. **Acceso directo.** `contenidoAccesoDirecto(URL_EN_LINEA, icono)` escribe el `.url`:

```ini
[InternetShortcut]
URL=https://here-to-slay-13l0.onrender.com
IconFile=C:\...\dist-app\HereToSlay\logo.ico
IconIndex=0
```

Windows **no resuelve rutas relativas** en `IconFile`, así que se guarda la ruta absoluta del icono.
Por eso, si mueves la carpeta del proyecto, vuelve a ejecutar `pnpm empaquetar`. Las líneas usan
CRLF.

## Qué contiene `dist-app/HereToSlay/`

```
dist-app/HereToSlay/
├── Here to Slay.url   Acceso directo al juego en Render
└── logo.ico           Icono del acceso directo
```

Puedes **copiar `Here to Slay.url` al escritorio** (o anclarlo): el icono sigue funcionando mientras
`logo.ico` siga en su sitio. **No se versiona** (`dist-app/` está en `.gitignore`): el icono se
construye con el logo, que es un recurso personal.

## Si cambia la dirección de Render

La dirección va escrita en el código a propósito: `URL_EN_LINEA` en
`apps/server/src/escritorio.ts`. Si el servicio de Render cambia de dirección
([DESPLIEGUE.md](DESPLIEGUE.md)), cambia esa constante y ejecuta `pnpm empaquetar`: el acceso directo
ya generado (y las copias en el escritorio) seguirán abriendo la dirección antigua.

## Problemas habituales

| Problema                                       | Causa y solución                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El acceso directo tiene el icono del navegador | Falta `logo.ico` (no instalaste los recursos, o moviste el proyecto). Ejecuta `pnpm recursos` y luego `pnpm empaquetar`, y vuelve a copiarlo al escritorio.   |
| Sigue saliendo un icono antiguo                | La caché de iconos del Explorador. Cierra sesión o reinicia el Explorador.                                                                                    |
| `No se pudo vaciar dist-app/HereToSlay`        | Hay un archivo abierto ahí (por ejemplo un `HereToSlay.exe` antiguo). Ciérralo y vuelve a ejecutar `pnpm empaquetar`.                                         |
| Abre una dirección que ya no funciona          | Cambió la dirección de Render: ver la sección anterior.                                                                                                       |
| La página tarda en cargar                      | Es el plan gratuito de Render despertando el servicio (alrededor de 1 minuto tras un rato inactivo, [DESPLIEGUE.md](DESPLIEGUE.md)). No es el acceso directo. |
| Quiero jugar sin internet o en la misma Wi-Fi  | El acceso directo no arranca servidor: usa `pnpm servidor` ([EN_LINEA.md](EN_LINEA.md)).                                                                      |

Para jugar por internet con túnel de Cloudflare o invitar, ver [EN_LINEA.md](EN_LINEA.md).
