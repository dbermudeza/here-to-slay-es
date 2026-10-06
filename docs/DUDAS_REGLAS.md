# Dudas de reglas

Puntos que `Referencias/Reglas.pdf` no aclara o deja ambiguos. Para cada uno se indica la
página, la decisión tomada (o la **interpretación provisional** que aplica el motor) y su
estado. En el código, cada punto provisional aparece como `// TODO(regla) D-xx`.

**Estados:** 🟡 pendiente de que decidas · ✅ resuelta (indica quién y cuándo).

| Id   | Tema                                                   | Estado |
| ---- | ------------------------------------------------------ | ------ |
| D-01 | Número de jugadores                                    | ✅     |
| D-02 | Reparto de Líderes                                     | ✅     |
| D-03 | Acción de 2–3 PA con menos PA                          | ✅     |
| D-04 | Límite de mano                                         | ✅     |
| D-05 | Tirada inmediata y límite de una por turno             | ✅     |
| D-06 | ¿A qué Héroes se puede equipar un Objeto?              | ✅     |
| D-07 | Objeto equipado cuando el Héroe se sacrifica           | ✅     |
| D-08 | Cierre de la ventana de Modificadores                  | ✅     |
| D-09 | Modificadores y tiradas de desafío                     | ✅     |
| D-10 | Desafíos encadenados                                   | ✅     |
| D-11 | Destino de la carta de Desafío                         | ✅     |
| D-12 | "Sacar" carta de la mano: ¿al azar?                    | ✅     |
| D-13 | Monstruo con rangos invertidos (Dracos)                | ✅     |
| D-14 | Mazo de Monstruos vacío                                | ✅     |
| D-15 | Momento de la victoria y modo difícil                  | ✅     |
| D-16 | Mazo principal vacío                                   | ✅     |
| D-17 | Composición del mazo: 112 frente a 115                 | ✅     |
| D-18 | Empates en la tirada de desafío                        | ✅     |
| D-19 | Momento de elegir los objetivos de un efecto           | ✅     |
| D-20 | Momento de la victoria en modo difícil                 | ✅     |
| D-21 | Sacar 2 cartas de la misma mano                        | ✅     |
| D-22 | Greedy Cheeks: quién elige la carta                    | ✅     |
| D-23 | Beary Wise: quién elige                                | ✅     |
| D-24 | "Con un Luchador/Ladrón en su Grupo"                   | ✅     |
| D-25 | Duración de los efectos temporales                     | ✅     |
| D-26 | Megababosa y el límite de 3 PA                         | ✅     |
| D-27 | La Garra Sombría                                       | ✅     |
| D-28 | El Cuerno Protector                                    | ✅     |
| D-29 | Caldero Anuro                                          | ✅     |
| D-30 | Fuzzy Cheeks: jugar un Héroe es obligatorio            | ✅     |
| D-31 | Wiggles                                                | ✅     |
| D-32 | Héroes movidos conservan su Objeto                     | ✅     |
| D-33 | Puño de la Razón y Guiverno Titán                      | ✅     |
| D-34 | A qué mano vuelven los Objetos devueltos               | ✅     |
| D-35 | Sabio Encapuchado y Magias desafiadas                  | ✅     |
| D-36 | Megababosa en el turno en que se mata                  | ✅     |
| D-37 | Orden: efecto de la carta y disparadores               | ✅     |
| D-38 | Disparadores durante una ventana                       | ✅     |
| D-39 | Las cartas jugadas "inmediatamente" se pueden desafiar | ✅     |
| D-40 | Elecciones forzosas automáticas                        | ✅     |
| D-41 | Hook: jugar el Objeto es obligatorio                   | ✅     |
| D-42 | Robo gratis al empezar el turno                        | ✅     |
| D-43 | Rendirse (opción de la versión digital)                | ✅     |
| D-44 | «Elige a un jugador»: solo otros jugadores             | ✅     |
| D-45 | Intercambio Forzado: qué Héroe se entrega              | ✅     |

---

### D-01 · Número de jugadores (p.1, p.3)

El reglamento no indica mínimo ni máximo. Menciona partidas de 2 jugadores (p.3) y hay 6 Líderes.
**✅ Resuelta (usuario, 2026-10-04):** de 2 a 6 jugadores, uno por Líder de Grupo.

### D-02 · Reparto de Líderes (p.1)

"Puedes tirar dados para determinar quién elige primero… o simplemente elegir libremente".
**✅ Resuelta (usuario, 2026-10-04):** los Líderes se **reparten al azar**. El orden de reparto
también es aleatorio (RNG con semilla) y empieza quien recibe el último Líder (R-015). En partidas
de 2 jugadores no entra el Líder Ladrón (R-011).

### D-03 · Acción de 2–3 PA con menos PA (p.2)

**✅ Resuelta (usuario, 2026-10-04):** como máximo se gastan los 3 PA del turno. Una acción no se
puede hacer si cuesta más PA de los que quedan.

### D-04 · Límite de mano (p.1–3)

**✅ Resuelta (usuario, 2026-10-04):** no hay límite de mano.

### D-05 · Tirada inmediata y límite de una por turno (p.2, ref)

Si juegas un Héroe y tiras inmediatamente, ¿cuenta como el uso de ese turno, de modo que no
puedas volver a gastar 1 PA para tirar por él ese mismo turno?
**✅ Resuelta (usuario, 2026-10-04):**

- Jugar el Héroe cuesta 1 PA. La tirada inmediata al jugarlo **no** cuesta PA.
- La tirada inmediata **cuenta como el uso de ese turno**: ese Héroe no puede volver a tirar
  hasta un turno posterior.
- Cualquier tirada posterior para activar la habilidad cuesta 1 PA, con el límite de una vez por
  turno de R-034.

### D-06 · ¿A qué Héroes se puede equipar un Objeto? (p.2)

El reglamento dice que los Objetos Malditos "pueden equiparse con cartas de Héroe enemigo". No
aclara si un Objeto normal puede equiparse a un Héroe enemigo ni un Maldito a uno propio.
**✅ Resuelta (usuario, 2026-10-04):** cualquier Objeto (normal o Maldito) puede equiparse a
cualquier Héroe sin Objeto, propio o ajeno.

### D-07 · Objeto equipado cuando el Héroe se sacrifica (p.2)

Se dice que el Objeto "se mueve con" el Héroe si este es destruido, arrebatado o devuelto a la
mano. El sacrificio no aparece en la lista.
**✅ Resuelta (usuario, 2026-10-04):** al sacrificar, el Objeto va al descarte con el Héroe, salvo
que una carta concreta diga otra cosa (Fase 2).

### D-08 · Cierre de la ventana de Modificadores (p.2)

"Una vez que todos los jugadores hayan terminado de jugar sus cartas modificadoras…". No se
define cómo se sabe que todos han terminado.
**✅ Resuelta (usuario, 2026-10-04):**

- Tras cada tirada empieza una cuenta regresiva de **5 segundos**.
- Cada Modificador jugado la **reinicia**. Si pasan 5 s sin un Modificador nuevo, la ventana se
  cierra (R-067).
- El motor no mide tiempo: el host (servidor o cliente local) gestiona el temporizador y envía
  `CERRAR_VENTANA` con el número de secuencia de la ventana. Los cierres con una secuencia antigua
  se rechazan.
- El motor nunca cierra la ventana antes de tiempo, ni siquiera si nadie tiene Modificadores,
  porque eso revelaría información de las manos.

### D-09 · Modificadores y tiradas de desafío (p.2)

**✅ Resuelta (usuario, 2026-10-04):**

- Hay una ventana para cada tirada. En un desafío las dos ventanas (una por participante) están
  abiertas **a la vez**.
- Cualquier jugador puede jugar su Modificador sobre cualquiera de las dos tiradas.
- Por eso la cuenta regresiva del desafío es de **10 s**, y también se reinicia con cada
  Modificador.

En el motor es una única ventana con dos tiradas. Cada Modificador indica a cuál se aplica.

### D-10 · Desafíos encadenados (p.2)

**✅ Resuelta (usuario, 2026-10-04):**

- La carta de Desafío no se puede desafiar.
- Una misma jugada solo se desafía una vez. Si varios quieren desafiar, vale el primero que lo
  declara.
- El desafiado gana **solo si saca estrictamente más**; con empate o menos, gana el desafiante.

### D-11 · Destino de la carta de Desafío (p.2)

**✅ Resuelta (usuario, 2026-10-04):** va al descarte inmediatamente, sea cual sea el resultado.

### D-12 · "Sacar" carta de la mano: ¿al azar? (texto de cartas)

Las cartas dicen "Pull a card from another player's hand" y el reglamento no define _pull_. Cartas
como Silent Shadow distinguen "mira la mano y elige", lo que sugiere que _pull_ es a ciegas.
**✅ Resuelta (usuario, 2026-10-04):** el jugador activo ve solo los **reversos** de la mano del
otro jugador y elige uno sin conocer su contenido. El motor baraja el orden con el RNG con
semilla para que la posición no revele nada. Solo cuando la carta dice expresamente que puedes
mirar la mano (_Sharp Fox_, _Silent Shadow_) se ve el contenido (R-097).

### D-13 · Monstruo con rangos invertidos — Dracos (texto de carta)

Dracos indica "5−: MATA" y "8+: SACRIFICA", al revés que el resto.
**✅ Resuelta (usuario, 2026-10-04):** confirmado: Dracos funciona con lógica inversa (5− mata,
8+ sacrifica). El esquema admite cualquier dirección en `exito`/`fracaso`.

### D-14 · Mazo de Monstruos vacío (p.3)

**✅ Resuelta (usuario, 2026-10-04):** no se repone: cada Monstruo que falta está en el Grupo de
algún jugador. Si no queda ninguno atacable, la partida sigue.

### D-15 · Momento de la victoria y modo difícil (p.1, p.3)

**✅ Resuelta (usuario, 2026-10-04):** hay dos modos de reglas, que se eligen al crear la partida.
Es la única diferencia entre ellos.

- **Normal:** se gana con 3 Monstruos (en el momento de matar el tercero) o con 6 clases al
  terminar el turno.
- **Difícil:** se gana con 6 clases + 1 Monstruo, o con 4 Monstruos + 3 clases. El momento exacto
  está en D-20.

### D-16 · Mazo principal vacío (p.1–3)

El reglamento no dice qué hacer si hay que ROBAR y el mazo está vacío. La frase final ("la
próxima vez que barajas el mazo") sugiere barajar.
**✅ Resuelta (usuario, 2026-10-04):** se baraja la pila de descarte y pasa a ser el nuevo
mazo, sin penalización (R-095).
**Caso límite (provisional):** si el mazo y el descarte están vacíos a la vez, no se roba nada
(la acción se permite, pero no tiene efecto).

### D-17 · Composición del mazo: 112 frente a 115 (p.1)

Con las copias que indicaste (Magia 13, Modificador 25, Desafío 14), más 48 Héroes y 12 Objetos
con 1 copia cada uno, el mazo suma **112**. El reglamento dice 115.
**✅ Resuelta (usuario, 2026-10-04):** Muñeco Señuelo, Moneda Particularmente Oxidada y Anillo
Realmente Grande tienen **2 copias**. Las máscaras y los Objetos Malditos tienen 1. Total: 115.

### D-18 · Empates en la tirada de desafío (p.2) — ✅ resuelta por el reglamento

"Si tu tirada es mayor o igual…": el empate lo gana quien desafía. Se anota para que no se
reinterprete.

### D-19 · Momento de elegir los objetivos de un efecto (p.2, R-062)

R-062 dice que, para modificar la tirada de otro jugador, se puede esperar a que ese jugador
**elija sus objetivos**.
**✅ Resuelta (usuario, 2026-10-04):** los objetivos **no** se declaran antes de tirar. Se eligen
cuando el efecto se activa, después de cerrarse la ventana de Modificadores. Así todos los
jugadores tienen motivos para intervenir en cualquier tirada, en lugar de un enfrentamiento 1 contra 1.

### D-20 · Momento de la victoria en modo difícil

No se indicó cuándo se comprueban las condiciones difíciles.
**✅ Resuelta (usuario, 2026-10-04), por analogía con el modo normal:**

- "**4 Monstruos + 3 clases**" se comprueba **al matar un Monstruo** (como los 3 Monstruos del
  modo normal) y también al terminar el turno.
- "**6 clases + 1 Monstruo**" solo se comprueba **al terminar el turno** (como el Grupo completo
  del modo normal).
- En ambos casos, las clases cuentan el Líder y las máscaras, igual que en el modo normal.

### D-21 · Sacar 2 cartas de la misma mano (Plundering Puma, Slippery Paws)

**✅ Resuelta (usuario, 2026-10-04):** son dos elecciones a ciegas sucesivas de la misma mano
(R-097).

### D-22 · Greedy Cheeks: quién elige la carta

**✅ Resuelta (usuario, 2026-10-04):** cada rival **elige** qué carta te da.

### D-23 · Beary Wise: quién elige

**✅ Resuelta (usuario, 2026-10-04):** cada rival elige qué carta descarta y tú eliges una de las
descartadas.

### D-24 · "Con un Luchador/Ladrón en su Grupo" (Tough Teddy, Smooth Mimimeow)

**✅ Resuelta (usuario, 2026-10-04):** cuenta también el Líder y las máscaras, igual que en los
requisitos de Monstruos (R-086).

### D-25 · Duración de los efectos temporales

**✅ Resuelta (usuario, 2026-10-04):**

- "Hasta tu próximo turno" (Calming Voice, Mighty Blade) termina al **empezar** tu siguiente
  turno.
- "Hasta el final de tu turno" (Wise Shield, Vibrant Glow, Hechizo Encantado, Iron Resolve)
  termina en tu fin de turno.

### D-26 · Megababosa y el límite de 3 PA

**✅ Resuelta (usuario, 2026-10-04):** su dueño tiene **4 PA** en cada uno de sus turnos (excepción
a D-03).

### D-27 · La Garra Sombría

**✅ Resuelta (usuario, 2026-10-04):** acción extra de 1 PA, una vez por turno, para SACAR a ciegas
una carta de la mano de otro jugador (acción `USAR_HABILIDAD`).

### D-28 · El Cuerno Protector

**✅ Resuelta (usuario, 2026-10-04):** cada vez que juegas un Modificador, eliges +1 o −1
adicional sobre esa misma tirada (es obligatorio elegir uno de los dos).

### D-29 · Caldero Anuro

**✅ Resuelta (usuario, 2026-10-04):** +1 a **todas** tus tiradas (Héroe, ataque y desafío);
se suma a otros bonos.

### D-30 · Fuzzy Cheeks: jugar un Héroe es obligatorio

**✅ Resuelta (usuario, 2026-10-04; corregida):** robas siempre y, si tienes algún Héroe en la mano
(incluido el que acabas de robar), **debes** jugar uno. Solo si no tienes Héroes no se juega
nada. Es la misma regla que Hook (D-41): un efecto solo es opcional si la carta dice "puedes".

### D-31 · Wiggles

**✅ Resuelta (usuario, 2026-10-04):** la tirada por el Héroe arrebatado es gratuita, cuenta como
el uso de ese Héroe este turno y tiene su propia ventana de Modificadores.

### D-32 · Héroes movidos conservan su Objeto (Tipsy Tootie, Intercambio Forzado)

**✅ Resuelta (usuario, 2026-10-04):** el Héroe que cambia de Grupo se lleva su Objeto (R-044).
Tipsy Tootie se mueve después de arrebatar.

---

Las siguientes surgieron al implementar la Fase 2 y **no estaban en el plan aprobado**. El motor
aplica la interpretación indicada y el código las marca con `TODO(regla)`.

### D-33 · Puño de la Razón y Guiverno Titán

- _El Puño de la Razón_: "cada vez que tiras para DESAFIAR, +2". **Provisional:** solo cuando
  eres tú quien desafía.
- _Guiverno Titán_: "cada vez que tiras por una carta de Desafío, +1". **Provisional:** en
  cualquier desafío en el que participes, como desafiante o como desafiado.
  **✅ Resuelta (usuario, 2026-10-04):** el Puño de la Razón suma +2 en **cualquier** desafío en el que participe su dueño (desafiando o desafiado), igual que el Guiverno Titán (+1).

### D-34 · A qué mano vuelven los Objetos devueltos

_Vientos Huracanados_ y _Vientos de Cambio_ devuelven el Objeto "a la mano de su jugador".
**Provisional:** a la mano del dueño del Héroe que lo llevaba, aunque lo hubiera jugado otro (por
ejemplo, un Objeto Maldito que le pusiste a un rival vuelve a la mano de ese rival).
_Holy Curselifter_ dice "a tu mano": va a la tuya.
**✅ Resuelta (usuario, 2026-10-04):** vuelven a la mano del dueño del Héroe.

### D-35 · Sabio Encapuchado y Magias desafiadas

"Cada vez que juegas una Magia, ROBA". **Provisional:** solo si la Magia se llega a resolver. Si
la desafían con éxito, no robas.
**✅ Resuelta (usuario, 2026-10-04):** confirmado.

### D-36 · Megababosa en el turno en que se mata

**Provisional:** si matas a la Megababosa en tu turno, ganas su PA extra en ese mismo turno.
**✅ Resuelta (usuario, 2026-10-04):** para simplificar, el PA extra se gana **a partir del turno siguiente** a matarla.

### D-37 · Orden: efecto de la carta y disparadores

**✅ Resuelta (usuario, 2026-10-04), opción A:** cuando un Héroe supera su tirada o se resuelve una Magia, primero se resuelve
el efecto de la carta y después las habilidades que se disparan (Aries Ártico, Moneda
Sospechosamente Brillante, Sabio Encapuchado…). Si varias se disparan a la vez, van en orden de
turno empezando por el jugador activo. Ejemplo: Peanut con la Moneda Sospechosamente Brillante
roba 2 y después descarta 1 (puede descartar una de las recién robadas).

### D-38 · Disparadores durante una ventana de Modificadores

Si una habilidad se dispara mientras hay una ventana abierta (p. ej. _Serpiente Coronada_ al
jugarse un Modificador, o _Alasangre_ al desafiar), **provisional:**

- la ventana se pausa hasta que se resuelva la habilidad;
- después, la cuenta regresiva se reinicia.
  **✅ Resuelta (usuario, 2026-10-04):** confirmado.

### D-39 · Las cartas jugadas "inmediatamente" se pueden desafiar

**Provisional:** jugar una carta "inmediatamente" por un efecto (Lucky Bucky, Hook, Malamamut…) no
cuesta PA, pero la carta pasa por la ventana de desafío como cualquier otra. Si es un Héroe, tiene
su tirada inmediata.
**✅ Resuelta (usuario, 2026-10-04):** no cuesta PA, pero se puede desafiar.

### D-40 · Elecciones forzosas automáticas

**Provisional:** cuando solo hay una opción posible y la elección no es opcional (un único
objetivo, un único rival válido, tener que descartar todas las cartas…), el motor la aplica sin
preguntar. Si es opcional ("puedes…"), siempre se pregunta.
**✅ Resuelta (usuario, 2026-10-04):** confirmado.

**Excepción (usuario, 2026-10-05):** cuando el efecto consiste en **mirar** cartas ocultas, mirarlas es
parte del efecto y se pregunta siempre. _Silent Shadow_ («mira la mano de otro jugador, elige una
carta…») muestra la mano y deja elegir aunque solo tenga una carta (como ya hacían _Sharp Fox_ y
_Bullseye_). D-40 se mantiene para las elecciones sobre información pública (Grupo, descarte…).

### D-41 · Hook: jugar el Objeto es obligatorio

"Juega inmediatamente un Objeto de tu mano y ROBA una carta." **Provisional:** como en _Fuzzy
Cheeks_ (D-30), jugar el Objeto es opcional y robas siempre.
**✅ Resuelta (usuario, 2026-10-04):** un efecto solo es opcional si la carta dice "puedes". Hook no lo dice: si tienes un Objeto y hay un Héroe sin Objeto, **debes** jugarlo (y después robas). Es la misma regla que _Fuzzy Cheeks_ (D-30): jugar el Héroe también es
obligatorio.

### D-42 · Robo gratis al empezar el turno

El reglamento en PDF no lo menciona.
**✅ Resuelta (usuario, 2026-10-04):** al empezar su turno, cada jugador roba automáticamente una carta
"por derecho" sin gastar PA; después empieza oficialmente su turno (R-029).
**Aplicado también al primer turno de la partida** (interpretación de "al inicio del turno de un
jugador"). Las habilidades de "cada vez que robas…" (Malamamut, Orthus, Rex Mayor) también se activan
con este robo.

### D-43 · Rendirse (opción de la versión digital)

El reglamento no contempla rendirse; es una opción añadida en la versión digital (menú de la partida).
**✅ Resuelta (usuario, 2026-10-05):**

- Se puede rendir cualquier jugador humano **en cualquier momento**, también fuera de su turno o con
  una ventana abierta. Los bots nunca se rinden.
- Quien se rinde deja de jugar: se salta su turno, cuenta como que pasa en las ventanas de desafío,
  no juega Modificadores, los efectos no lo eligen y las pasivas de su Líder y sus Monstruos dejan de
  actuar. Lo que estuviera esperando su decisión se resuelve solo (primera opción legal; la tirada
  inmediata, sin tirar).
- **Sus cartas se descartan:** cuando no queda nada pendiente en la pila, su mano, sus Héroes y sus
  Objetos van a la pila de descarte. Su Líder y sus Monstruos matados se quedan con él, fuera de juego.
- **Victoria por rendición:** gana el único jugador humano que no se ha rendido cuando todos los demás
  humanos se han rendido. Los bots no cuentan (en línea, con Ana, Beto y un bot: si Ana se rinde, gana
  Beto).
- **Si se rinde el último humano** (por ejemplo, tú contra bots), la partida sigue entre los bots hasta
  que uno cumpla una condición de victoria; quien se rindió puede quedarse a verla.

### D-44 · «Elige a un jugador»: solo otros jugadores

_Heavy Bear_ (el jugador elegido DESCARTA 2 cartas) y _Hopper_ (el jugador elegido SACRIFICA un
Héroe) dicen «Choose a player», no «another player». **Provisional:** solo se puede elegir a otro jugador.
**✅ Resuelta (usuario, 2026-10-05):** «Choose a player» significa **solo otros jugadores**; no puedes
elegirte a ti mismo.

### D-45 · Intercambio Forzado: qué Héroe se entrega

Se ARREBATA un Héroe de otro jugador y después se mueve un Héroe del propio Grupo al suyo. La carta
no dice si el Héroe que entregas puede ser el que acabas de ARREBATAR.
**✅ Resuelta (usuario, 2026-10-05):** lectura literal: puede ser **cualquier** Héroe de tu Grupo,
incluido el recién arrebatado (que entonces vuelve a su dueño). Si no tienes otro Héroe, el
recién arrebatado vuelve solo a su dueño.
