# Jugar en línea

El modo en línea usa un **servidor autoritativo**: la partida vive en el equipo que hace de
anfitrión y cada jugador, desde su navegador, solo recibe lo que puede ver (su mano, la mesa y el
número de cartas de los demás). No hace falta contratar ningún servidor.

## 1. Arrancar el servidor (en el equipo anfitrión)

Requisitos: haber hecho `pnpm install` y `pnpm recursos` (las cartas; ver el README).

```sh
pnpm servidor
```

Compila la aplicación web y arranca el servidor en el puerto **3000**. Verás algo así:

```
  En este equipo:     http://localhost:3000
  En la red local:    http://192.168.1.34:3000
```

Para usar otro puerto: `PUERTO=4000 pnpm servidor` (en PowerShell: `$env:PUERTO=4000; pnpm servidor`).

**Sin terminal:** `pnpm empaquetar` genera `dist-app/HereToSlay/HereToSlay.exe`. Con doble clic
arranca el servidor en el puerto 3000 (o en uno libre, si otro programa lo ocupa) y abre el
navegador; si ya estaba en marcha, solo abre el navegador. La ventana que se queda abierta muestra
las mismas direcciones; al cerrarla se detiene el servidor. Windows puede avisar la primera vez
(SmartScreen y el cortafuegos) porque el ejecutable no está firmado: permite el acceso en redes
privadas para que entren los de tu Wi-Fi.

## 2. Jugar en la misma red (Wi-Fi de casa)

1. Todos se conectan a la misma Wi-Fi.
2. Cada jugador abre en su navegador la dirección **"En la red local"** (p. ej.
   `http://192.168.1.34:3000`). El anfitrión también puede usar `http://localhost:3000`.
3. Uno pulsa **Jugar en línea → Crear sala** y comparte el **código de 5 letras**.
4. Los demás pulsan **Jugar en línea → Unirse**, escriben el código y su nombre, y marcan **Estoy
   listo**.
5. El anfitrión puede añadir bots y elegir reglas, duración de las ventanas y tiempo máximo por
   decisión. Después pulsa **Empezar partida**.

Si Windows pregunta por el **Firewall** la primera vez, permite el acceso en **redes privadas**.

## 3. Jugar por internet

El servidor está en tu casa, así que hay que hacerlo accesible desde fuera. Dos opciones:

### Opción A: túnel de Cloudflare desde la propia sala (recomendada)

1. Instala `cloudflared` una vez:
   - Windows: `winget install --id Cloudflare.cloudflared`
   - macOS: `brew install cloudflared`

   Después cierra y vuelve a abrir la terminal (para que encuentre el programa).

2. Arranca el servidor (`pnpm servidor`), abre `http://localhost:3000` **en el mismo equipo** y crea
   la sala.
3. En **Invitar a jugar → Jugar por internet**, pulsa **Abrir acceso por internet**. En unos segundos
   aparece el **enlace por internet** (`https://….trycloudflare.com/?sala=CÓDIGO`): pulsa **Copiar** y
   envíaselo a los demás. Al abrirlo entran directamente a "Unirse" con el código puesto.

El botón solo aparece en el equipo del servidor; los invitados ven el enlace, pero no pueden abrir ni
cerrar el túnel. El túnel se cierra con **Cerrar acceso por internet** o al detener el servidor.

#### A mano, en otra terminal

Si lo prefieres, con el servidor en marcha, en otra terminal:

```sh
cloudflared tunnel --url http://localhost:3000
```

3. Aparecerá una dirección del tipo `https://palabras-al-azar.trycloudflare.com`. Compártela con
   los demás jugadores: funciona mientras la terminal siga abierta.

Es un túnel temporal y gratuito; cada vez que lo arrancas cambia la dirección.

### Opción B: abrir un puerto en el router

1. En el router, redirige el **puerto TCP 3000** a la IP local del equipo anfitrión.
2. Comparte `http://TU-IP-PÚBLICA:3000` (tu IP pública aparece en cualquier web tipo "cuál es mi IP").

Ten en cuenta que así el servidor queda expuesto a internet: ciérralo (Ctrl+C) al terminar.

> ⚠️ El servidor sirve las imágenes y los textos de tus cartas a quien tenga la dirección. Úsalo
> solo con amigos y no publiques la dirección.

## 4. Durante la partida

- **Reconexión:** si se cae la conexión o alguien recarga la página, vuelve automáticamente a su
  asiento (en el inicio aparece "Volver a tu sala en línea").
- **Desconexiones largas:** si un jugador no vuelve en **60 segundos**, un bot normal juega por él
  hasta que regrese.
- **Tiempo máximo por decisión** (opcional, lo elige el anfitrión): si alguien agota su tiempo, un
  bot decide por él esa vez.
- **Al terminar**, el anfitrión puede pulsar **Volver a la sala** para jugar otra con los mismos
  jugadores.
- Las salas sin nadie conectado se borran a los 30 minutos.
- **Enlaces de invitación:** en la sala, "Invitar a jugar" muestra enlaces con el código ya puesto,
  para la red local y (si está abierto) por internet.

## 5. Desarrollo

```sh
pnpm --filter @hts/server start   # servidor en :3000 (sin compilar la web)
pnpm dev                          # web en :5173; /socket.io se redirige al servidor
```
