# Jugar en línea

El modo en línea usa un **servidor autoritativo**: la partida vive en el equipo que hace de
servidor y cada jugador, desde su navegador, solo recibe lo que puede ver (su mano, la mesa y el
número de cartas de los demás). No hace falta contratar ningún servidor.

Esta es la guía práctica. El detalle técnico (mensajes, seguridad, variables de entorno) está en
[SERVIDOR_Y_PROTOCOLO.md](SERVIDOR_Y_PROTOCOLO.md), y el del ejecutable en
[ESCRITORIO.md](ESCRITORIO.md).

## 1. Arrancar el servidor (en el equipo que hace de servidor)

Hay dos formas. Las dos necesitan haber instalado antes las dependencias y los recursos de las
cartas (`pnpm install` y `pnpm recursos`; ver el `README.md`).

### Con el ejecutable (sin terminal)

`pnpm empaquetar` genera `dist-app/HereToSlay/HereToSlay.exe` (una vez; vuelve a ejecutarlo tras
actualizar el juego). Con doble clic arranca el servidor en el puerto **3000** (o en uno libre, si
otro programa lo ocupa) y abre el navegador; si ya estaba en marcha, solo abre el navegador. La
ventana que se queda abierta muestra las direcciones para invitar; **al cerrarla se detiene el
servidor**. La primera vez Windows puede avisar (SmartScreen y el cortafuegos) porque el ejecutable
no está firmado: ver [ESCRITORIO.md](ESCRITORIO.md#problemas-habituales).

### Con la terminal

```sh
pnpm servidor
```

Compila la aplicación web y arranca el servidor en el puerto **3000**. Verás algo así:

```
  En este equipo:     http://localhost:3000
  En la red local:    http://192.168.1.20:3000
```

Para usar otro puerto: `PUERTO=4000 pnpm servidor` (en PowerShell: `$env:PUERTO=4000; pnpm servidor`).
Se detiene con Ctrl+C. Las demás variables de entorno están en
[SERVIDOR_Y_PROTOCOLO.md](SERVIDOR_Y_PROTOCOLO.md#variables-de-entorno).

## 2. Jugar en la misma red (Wi-Fi de casa)

1. Todos se conectan a la misma Wi-Fi.
2. Cada jugador abre en su navegador la dirección **"En la red local"** (p. ej.
   `http://192.168.1.20:3000`). En el equipo del servidor también vale `http://localhost:3000`.
3. Uno pulsa **Jugar en línea → Crear sala** y comparte el **código de 5 letras** (o el enlace de
   **Invitar a jugar**, que ya lleva el código).
4. Los demás pulsan **Jugar en línea → Unirse**, escriben el código y su nombre, y marcan **Estoy
   listo**.
5. Quien creó la sala puede añadir bots, quitar jugadores y elegir las reglas, la duración de las
   ventanas y el tiempo máximo por decisión. Cuando todos están listos (de 2 a 6 jugadores, bots
   incluidos), pulsa **Empezar partida**.

Si Windows pregunta por el **cortafuegos** la primera vez, permite el acceso en **redes privadas**.

## 3. Jugar por internet

El servidor está en tu casa, así que hay que hacerlo accesible desde fuera. Dos opciones (y una tercera, si tu red bloquea el túnel: el [servidor en la nube](DESPLIEGUE.md)):

### Opción A: túnel de Cloudflare desde la propia sala (recomendada)

1. Instala `cloudflared` una vez:
   - Windows: `winget install --id Cloudflare.cloudflared`
   - macOS: `brew install cloudflared`

   El servidor lo busca en el `PATH` y en las carpetas de instalación habituales. Si aun así no lo
   encuentra, cierra y vuelve a abrir la terminal, o indica su ruta en la variable `CLOUDFLARED`.

2. Arranca el servidor (ejecutable o `pnpm servidor`), abre `http://localhost:3000` **en el mismo
   equipo** y crea la sala.
3. En **Invitar a jugar → Jugar por internet**, pulsa **Abrir acceso por internet**. En unos segundos
   aparece el **enlace por internet** (`https://….trycloudflare.com/?sala=CÓDIGO`): pulsa **Copiar** y
   envíaselo a los demás. Al abrirlo entran directamente a "Unirse" con el código puesto.

El botón solo aparece en el equipo del servidor; los invitados ven el enlace, pero no pueden abrir ni
cerrar el túnel. El túnel se cierra con **Cerrar acceso por internet** o al detener el servidor. Si
`cloudflared` no está instalado, tarda demasiado (45 s) o se cae, la sala lo indica.

#### A mano, en otra terminal

Si lo prefieres, con el servidor en marcha, en otra terminal:

```sh
cloudflared tunnel --url http://localhost:3000
```

Aparecerá una dirección del tipo `https://palabras-al-azar.trycloudflare.com`. Compártela con los
demás jugadores: funciona mientras esa terminal siga abierta.

En los dos casos es un túnel temporal y gratuito; cada vez que lo abres cambia la dirección.

#### Si la red bloquea el túnel (`RED_BLOQUEADA`)

El túnel solo muestra el enlace cuando ya funciona. Si `cloudflared` no consigue conectar porque la
red no deja salir por el puerto **7844** (habitual en redes de universidad, empresa o wifi
pública), la sala avisa con el error `RED_BLOQUEADA` y no ofrece ningún enlace. Opciones: conectar
el equipo a otra red (la de casa o los datos del móvil), o desplegar el servidor en la nube con
**[DESPLIEGUE.md](DESPLIEGUE.md)**, que no depende de tu red.

### Opción B: abrir un puerto en el router

1. En el router, redirige el **puerto TCP 3000** a la IP local del equipo servidor.
2. Comparte `http://TU-IP-PÚBLICA:3000` (tu IP pública aparece en cualquier web tipo "cuál es mi IP").

Ten en cuenta que así el servidor queda expuesto a internet: ciérralo al terminar.

> ⚠️ El servidor sirve las imágenes y los textos de tus cartas a quien tenga la dirección. Úsalo
> solo con amigos y no publiques la dirección.

## 4. Durante la partida

- **Pausas para todos:** cuando se activa la habilidad de un Líder, cuando alguien mata a un
  Monstruo y tras cada resultado (una tirada, un desafío, un ataque o una carta que se resuelve), la
  partida se detiene unos segundos **para todos a la vez** (unos 4 s para el Líder y el Monstruo, 3 s
  para un resultado). Mientras dura, nadie puede jugar y las cuentas atrás se congelan; después
  siguen donde estaban.
- **Reconexión:** si se cae la conexión o alguien recarga la página, vuelve automáticamente a su
  asiento (en el inicio aparece "Volver a tu sala en línea").
- **Desconexiones largas:** si un jugador no vuelve en **60 segundos**, un bot normal juega por él
  hasta que regrese.
- **Tiempo máximo por decisión** (opcional, lo elige quien creó la sala): si alguien agota su
  tiempo, un bot decide por él esa vez.
- **Al terminar**, quien creó la sala puede pulsar **Volver a la sala** para jugar otra con los
  mismos jugadores.
- Las salas sin nadie conectado se borran a los 30 minutos, y todas desaparecen al detener el
  servidor.

## 5. Desarrollo

```sh
pnpm --filter @hts/server start   # servidor en :3000 (sin compilar la web)
pnpm dev                          # web en :5173; /socket.io se redirige al servidor
```

Ver [SERVIDOR_Y_PROTOCOLO.md](SERVIDOR_Y_PROTOCOLO.md#desarrollo) y [ANFITRION.md](ANFITRION.md).
