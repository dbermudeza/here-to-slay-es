# Dudas de reglas

Puntos que `Referencias/Reglas.pdf` no aclara o deja ambiguos. Para cada uno se indica la
página, la decisión tomada (o la **interpretación provisional** que aplica el motor) y su
estado. En el código, cada punto provisional aparece como `// TODO(regla) D-xx`.

**Estados:** 🟡 pendiente de que decidas · ✅ resuelta (indica quién y cuándo).

| Id   | Tema                                         | Estado |
| ---- | -------------------------------------------- | ------ |
| D-01 | Número de jugadores                          | ✅     |
| D-02 | Reparto de Líderes                           | ✅     |
| D-03 | Acción de 2–3 PA con menos PA                | ✅     |
| D-04 | Límite de mano                               | ✅     |
| D-05 | Tirada inmediata y límite de una por turno   | ✅     |
| D-06 | ¿A qué Héroes se puede equipar un Objeto?    | ✅     |
| D-07 | Objeto equipado cuando el Héroe se sacrifica | ✅     |
| D-08 | Cierre de la ventana de Modificadores        | ✅     |
| D-09 | Modificadores y tiradas de desafío           | ✅     |
| D-10 | Desafíos encadenados                         | ✅     |
| D-11 | Destino de la carta de Desafío               | ✅     |
| D-12 | "Sacar" carta de la mano: ¿al azar?          | ✅     |
| D-13 | Monstruo con rangos invertidos (Dracos)      | ✅     |
| D-14 | Mazo de Monstruos vacío                      | ✅     |
| D-15 | Momento de la victoria y modo difícil        | ✅     |
| D-16 | Mazo principal vacío                         | ✅     |
| D-17 | Composición del mazo: 112 frente a 115       | ✅     |
| D-18 | Empates en la tirada de desafío              | ✅     |
| D-19 | Objetivos declarados antes de tirar          | 🟡     |
| D-20 | Momento de la victoria en modo difícil       | 🟡     |

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

Las cartas dicen "Pull a card from another player's hand" y el reglamento no define *pull*. Cartas
como Silent Shadow distinguen "mira la mano y elige", lo que sugiere que *pull* es a ciegas.
**✅ Resuelta (usuario, 2026-10-04):** el jugador activo ve solo los **reversos** de la mano del
otro jugador y elige uno sin conocer su contenido. El motor baraja el orden con el RNG con
semilla para que la posición no revele nada. Solo cuando la carta dice expresamente que puedes
mirar la mano (*Sharp Fox*, *Silent Shadow*) se ve el contenido (R-097).

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

### D-19 · Objetivos declarados antes de tirar (p.2, R-062) — 🟡

R-062 dice que, para modificar la tirada de otro jugador, se puede esperar a que ese jugador
**elija sus objetivos**. Eso implica que los objetivos se conocen antes de cerrar la ventana de
Modificadores.
**Provisional (afecta sobre todo a la Fase 2):**
- Si el efecto de un Héroe elige un objetivo inicial ("destruye un Héroe", "elige un jugador"),
  ese objetivo se declara **junto con la tirada**.
- Las elecciones que dependen de lo que pase después (p. ej. "roba 2 y, si una es…") se hacen
  tras la tirada.

### D-20 · Momento de la victoria en modo difícil — 🟡

No se indicó cuándo se comprueban las condiciones difíciles.
**Provisional (por analogía con el modo normal):**
- "**4 Monstruos + 3 clases**" se comprueba **al matar un Monstruo** (como los 3 Monstruos del
  modo normal) y también al terminar el turno.
- "**6 clases + 1 Monstruo**" solo se comprueba **al terminar el turno** (como el Grupo completo
  del modo normal).
- En ambos casos, las clases cuentan el Líder y las máscaras, igual que en el modo normal.
