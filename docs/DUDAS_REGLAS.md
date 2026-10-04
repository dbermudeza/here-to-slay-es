# Dudas de reglas

Puntos que `Referencias/Reglas.pdf` no aclara o deja ambiguos. Para cada uno se indica la
página, la **interpretación provisional** que aplicará el motor (la más literal posible) y su
estado. En el código, cada punto aparece como `// TODO(regla) D-xx` en el lugar donde se aplica.

**Estados:** 🟡 pendiente de que decidas · ✅ resuelta (indica quién y cuándo).

| Id   | Tema                                         | Estado |
| ---- | -------------------------------------------- | ------ |
| D-01 | Número de jugadores                          | 🟡     |
| D-02 | Orden de elección de Líder                   | 🟡     |
| D-03 | Acción de 2–3 PA con menos PA                | 🟡     |
| D-04 | Límite de mano                               | 🟡     |
| D-05 | Tirada inmediata y límite de una por turno   | 🟡     |
| D-06 | ¿A qué Héroes se puede equipar un Objeto?    | 🟡     |
| D-07 | Objeto equipado cuando el Héroe se sacrifica | 🟡     |
| D-08 | Cierre de la ventana de Modificadores        | 🟡     |
| D-09 | Modificadores y tiradas de desafío           | 🟡     |
| D-10 | Desafíos encadenados                         | 🟡     |
| D-11 | Destino de la carta de Desafío               | 🟡     |
| D-12 | "Sacar" carta de la mano: ¿al azar?          | 🟡     |
| D-13 | Monstruo con rangos invertidos (Dracos)      | 🟡     |
| D-14 | Mazo de Monstruos vacío                      | 🟡     |
| D-15 | Momento de la victoria por 3 Monstruos       | 🟡     |
| D-16 | Mazo principal vacío                         | 🟡     |
| D-17 | Composición del mazo: 112 frente a 115       | 🟡     |
| D-18 | Empates en la tirada de desafío              | ✅     |

---

### D-01 · Número de jugadores (p.1, p.3)

El reglamento no indica mínimo ni máximo. Menciona partidas de 2 jugadores (p.3) y hay 6 Líderes.
**Provisional:** de 2 a 6 jugadores (uno por Líder).

### D-02 · Orden de elección de Líder (p.1)

"Puedes tirar dados para determinar quién elige primero… o simplemente elegir libremente".
**Provisional:** orden de elección aleatorio con el RNG de la partida. Cada jugador elige su
Líder y empieza quien eligió el último (R-015). En partidas de 2 no se ofrece el Líder Ladrón.

### D-03 · Acción de 2–3 PA con menos PA (p.2)

No se dice explícitamente, pero el coste implica que hacen falta los PA.
**Provisional:** una acción no se puede hacer si cuesta más PA de los que quedan.

### D-04 · Límite de mano (p.1–3)

No se menciona ningún límite de mano.
**Provisional:** sin límite.

### D-05 · Tirada inmediata y límite de una por turno (p.2, ref)

Si juegas un Héroe y tiras inmediatamente, ¿cuenta como el uso de ese turno, de modo que no
puedas volver a gastar 1 PA para tirar por él ese mismo turno?
**Provisional:** sí cuenta, porque es una tirada "para usar el efecto" de ese Héroe y la regla
dice "no más de una vez por turno". Si se arrebata a un Héroe ya usado, el límite sigue
aplicándose a esa carta durante el turno.

### D-06 · ¿A qué Héroes se puede equipar un Objeto? (p.2)

El reglamento dice que los Objetos Malditos "pueden equiparse con cartas de Héroe enemigo". No
aclara si un Objeto normal puede equiparse a un Héroe enemigo ni un Maldito a uno propio.
**Provisional:** cualquier Objeto (normal o Maldito) puede equiparse a cualquier Héroe sin Objeto,
propio o ajeno.

### D-07 · Objeto equipado cuando el Héroe se sacrifica (p.2)

Se dice que el Objeto "se mueve con" el Héroe si este es destruido, arrebatado o devuelto a la
mano. El sacrificio no aparece en la lista.
**Provisional:** al sacrificar, el Objeto también va al descarte con el Héroe. Excepción: Shurikitty
indica que el Objeto va a tu mano.

### D-08 · Cierre de la ventana de Modificadores (p.2)

"Una vez que todos los jugadores hayan terminado de jugar sus cartas modificadoras…". No se
define cómo se sabe que todos han terminado.
**Provisional:** tras cada tirada se abre una ventana de respuesta. Cada jugador con Modificadores
en mano puede jugar uno o pasar. Cuando alguien juega un Modificador, todos recuperan la opción
de responder. La ventana se cierra cuando **todos han pasado de forma consecutiva** después del
último Modificador, o cuando vence el temporizador configurable (que cuenta como pasar).

### D-09 · Modificadores y tiradas de desafío (p.2)

En un desafío hay dos tiradas.
**Provisional:** una sola ventana de Modificadores que se abre después de que **ambos** hayan
tirado (R-063). Cada Modificador indica a qué tirada se aplica: la del que desafía o la del
desafiado.

### D-10 · Desafíos encadenados (p.2)

"Solo se puede desafiar una vez la carta jugada". No se dice si se puede desafiar la propia carta
de Desafío.
**Provisional:** no. La carta de Desafío no es un Héroe, Objeto ni Magia, así que no se puede
desafiar. Si varios jugadores quieren desafiar a la vez, se resuelve el **primero en declararlo**.
En hot-seat y con bots, el orden es horario a partir del jugador activo.

### D-11 · Destino de la carta de Desafío (p.2)

No se dice qué pasa con la carta de Desafío jugada.
**Provisional:** va a la pila de descarte, gane o pierda.

### D-12 · "Sacar" carta de la mano: ¿al azar? (texto de cartas)

Las cartas dicen "Pull a card from another player's hand" y el reglamento no define *pull*. Cartas
como Silent Shadow distinguen "mira la mano y elige", lo que sugiere que *pull* es a ciegas.
**Provisional:** se saca una carta **al azar** (RNG con semilla) sin ver la mano.

### D-13 · Monstruo con rangos invertidos — Dracos (texto de carta)

Dracos indica "5−: MATA" y "8+: SACRIFICA", al revés que el resto.
**Provisional:** se aplica literalmente lo impreso. El esquema admite cualquier dirección en
`exito`/`fracaso`. ¿Puedes confirmar con tu copia física que la carta es así?

### D-14 · Mazo de Monstruos vacío (p.3)

¿Qué pasa si se mata un Monstruo y el mazo de Monstruos está vacío?
**Provisional:** no se repone y quedan menos Monstruos en el centro. Si no queda ninguno atacable,
la partida sigue y solo se puede ganar por Grupo completo.

### D-15 · Momento de la victoria por 3 Monstruos (p.1, p.3)

La victoria por Grupo completo es "al terminar tu turno". La de 3 Monstruos no indica el momento.
**Provisional:** se gana **inmediatamente** al matar el tercer Monstruo.

### D-16 · Mazo principal vacío (p.1–3)

El reglamento no dice qué hacer si hay que ROBAR y el mazo está vacío. La frase final ("la
próxima vez que barajas el mazo") sugiere barajar.
**Provisional:** se baraja la pila de descarte para formar un nuevo mazo. Si ambos están vacíos,
no se roba (la acción se permite, pero no hace nada).

### D-17 · Composición del mazo: 112 frente a 115 (p.1)

Con las copias que indicaste (Magia 13, Modificador 25, Desafío 14), más 48 Héroes y 12 Objetos
con 1 copia cada uno, el mazo suma **112**. El reglamento dice 115.
**Provisional:** 1 copia por Objeto. Los 12 Objetos están marcados con `"revisar": true` en
`cartas.es.json`. Revisa tu copia física: probablemente hay 3 Objetos repetidos.

### D-18 · Empates en la tirada de desafío (p.2) — ✅ resuelta por el reglamento

"Si tu tirada es mayor o igual…": el empate lo gana quien desafía. Se anota para que no se
reinterprete.
