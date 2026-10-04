# Especificación de reglas — Here to Slay (juego base)

Fuente única: `Referencias/Reglas.pdf` (3 páginas) y la carta de referencia de reglas
(`Referencias/Imagenes/Cartas/Carta_Reglas/`). Cada regla lleva un identificador `R-xxx` y la
página de origen (`p.N`, o `ref` para la carta de referencia). Los tests del motor citan estos ids.
Las ambigüedades están en [DUDAS_REGLAS.md](DUDAS_REGLAS.md) como `D-xx`.

## 0. Glosario de verbos

El PDF en español usa "ROBAR" para dos verbos distintos del original. El código y la UI usan:

| Original  | Español en el proyecto | Significado (p.3)                                                           |
| --------- | ---------------------- | --------------------------------------------------------------------------- |
| DRAW      | **ROBAR**              | Tomar la carta superior del mazo y añadirla a tu mano.                      |
| STEAL     | **ARREBATAR**          | Mover una carta del Grupo de otro jugador a tu Grupo.                       |
| PULL      | **SACAR**              | Tomar una carta de la mano de otro jugador viendo solo los reversos. → D-12 |
| DISCARD   | **DESCARTAR**          | Mover una carta de tu mano a la pila de descarte.                           |
| DESTROY   | **DESTRUIR**           | Mover una carta del Grupo de otro jugador a la pila de descarte.            |
| SACRIFICE | **SACRIFICAR**         | Mover una carta de tu propio Grupo a la pila de descarte.                   |
| CHALLENGE | **DESAFIAR**           | Intentar impedir que otro jugador juegue un Héroe, Objeto o Magia.          |
| ATTACK    | **ATACAR**             | Tirar para MATAR un Monstruo.                                               |
| SLAY      | **MATAR**              | Añadir a tu Grupo un Monstruo atacado con éxito.                            |
| Party     | **Grupo**              | Área frente a ti con tu Líder, Héroes (con sus Objetos) y Monstruos.        |

Clases (p.2): Luchador (Fighter), Bardo (Bard), Guardián (Guardian), Cazador (Ranger),
Ladrón (Thief), Mago (Wizard). Símbolo gris "H" = un Héroe de cualquier clase.

## 1. Componentes (p.1)

- **R-001** Mazo principal: 115 cartas estándar de cinco tipos: Héroe, Objeto (incluye Objeto Maldito), Magia, Modificador y Desafío (p.1, p.2).
- **R-002** 6 cartas de Líder de Grupo, una por clase (p.1).
- **R-003** 15 cartas de Monstruo (p.1).
- **R-004** 2 dados de seis caras. Toda "tirada" es la suma de 2d6 (p.1, p.2).
- **R-005** Las cartas de referencia de reglas no participan en el juego (p.1).
- **R-006** Número de jugadores: de **2 a 6**, uno por Líder de Grupo (D-01, decisión del usuario).

## 2. Preparación (p.1)

- **R-010** Cada jugador recibe **al azar** un Líder de Grupo y lo coloca en su Grupo (p.1, D-02).
- **R-011** En partidas de 2 jugadores no se puede elegir el Líder Ladrón (_La Garra Sombría_) (p.3).
- **R-012** Los Líderes no elegidos se retiran de la partida (p.1).
- **R-013** Se baraja el mazo principal y se reparten **5 cartas** a cada jugador. El resto queda boca abajo como mazo; junto a él, la pila de descarte (vacía) (p.1).
- **R-014** Se barajan los Monstruos y se ponen **3 boca arriba** en el centro; el resto forma el mazo de Monstruos boca abajo (p.1).
- **R-015** Empieza quien recibió **el último** Líder (el orden de reparto es aleatorio); el turno avanza en sentido horario (p.1, D-02).

## 3. Turno y puntos de acción (p.1–2, ref)

- **R-020** En tu turno tienes **3 puntos de acción (PA)**. Las acciones se hacen en cualquier orden y se pueden repetir mientras queden PA (p.1, ref).
- **R-021** Acciones de **1 PA** (p.2):
  - a) ROBAR una carta del mazo.
  - b) Jugar una carta de Héroe, Objeto o Magia de tu mano.
  - c) Tirar para usar el efecto de un Héroe de tu Grupo.
- **R-022** Acción de **2 PA**: ATACAR un Monstruo (p.2, p.3).
- **R-023** Acción de **3 PA**: DESCARTAR toda tu mano (si tienes cartas) y ROBAR 5 cartas (p.2).
- **R-024** No se puede gastar más PA de los que quedan. → D-03
- **R-025** Si un efecto dice que hagas una acción "inmediatamente", esa acción no cuesta PA (p.2).
- **R-026** El turno termina cuando te quedas sin PA o decides no hacer más acciones (p.2).
- **R-027** Al terminar el turno se comprueban las condiciones de victoria de fin de turno (§11) y el turno pasa al siguiente jugador en sentido horario.
- **R-028** Los PA no usados se pierden. No hay límite de mano (D-04).
- **R-029** Al empezar su turno, el jugador **roba una carta gratis** (sin gastar PA); después empieza oficialmente su turno con sus 3 PA. También en el primer turno de la partida. Si el mazo está vacío, se aplica R-095 (D-42).

## 4. Cartas de Héroe (p.2, ref)

- **R-030** Solo se juegan en tu turno, cuestan 1 PA y van a tu Grupo (p.2).
- **R-031** Cada Héroe tiene una clase, un efecto y un requisito de tirada "N+". Para usar el efecto hay que tirar 2d6 y obtener **≥ N** (con modificadores) (p.2).
- **R-032** Al jugar un Héroe desde la mano puedes tirar **inmediatamente** para usar su efecto, sin coste adicional: solo se paga el PA de jugar la carta (p.2, ref, R-025, D-05).
- **R-033** Un Héroe ya en tu Grupo: 1 PA para intentar usar su efecto (p.2).
- **R-034** No puedes tirar para usar el efecto del **mismo Héroe más de una vez por turno**, aunque la primera tirada falle. La tirada inmediata de R-032 cuenta como ese uso (p.2, ref, D-05).
- **R-035** Si la tirada falla, no se recupera el PA (p.2).
- **R-036** No hay límite de Héroes en el Grupo (p.2).

## 5. Cartas de Objeto (p.2)

- **R-040** Solo se juegan en tu turno y cuestan 1 PA (p.2).
- **R-041** Al jugar un Objeto se equipa inmediatamente a un Héroe. Un Objeto normal o Maldito puede equiparse a un Héroe propio o de otro jugador (D-06).
- **R-042** Solo se equipa a Héroes, nunca a Líderes (p.2).
- **R-043** Máximo **un Objeto por Héroe**. No se puede reemplazar un Objeto equipado por otro (p.2). Un Objeto no se puede jugar si no hay ningún Héroe válido sin Objeto.
- **R-044** Si un Héroe con Objeto es destruido, arrebatado o devuelto a la mano, el Objeto **lo acompaña** (p.2). Si el Héroe se sacrifica, su Objeto también va al descarte, salvo que una carta diga otra cosa (D-07).
- **R-045** Los Objetos Malditos dan efectos negativos y siguen contando como Objetos a efectos de cartas (p.2).
- **R-046** Las máscaras hacen que el Héroe equipado se considere de otra clase **en lugar de** la suya (texto de carta).

## 6. Cartas de Magia (p.2)

- **R-050** Solo se juegan en tu turno y cuestan 1 PA (p.2).
- **R-051** Efecto de un solo uso. Después de resolverse, la carta va a la pila de descarte (p.2).

## 7. Cartas de Modificador (p.2)

- **R-060** Se pueden jugar desde la mano **cuando cualquier jugador tira los dados** (incluido uno mismo), en cualquier turno, sin coste de PA (p.2).
- **R-061** Modifican la tirada en la cantidad indicada. Si la carta tiene dos opciones (p. ej. +1/−3), quien la juega declara una (p.2).
- **R-062** Los objetivos de un efecto se eligen al activarse, después de cerrarse la ventana de Modificadores, no antes de tirar (p.2, D-19).
- **R-063** En un desafío se puede esperar a que **ambos** jugadores hayan tirado antes de decidir (p.2).
- **R-064** Se pueden jugar **varios** Modificadores sobre la misma tirada, y varios jugadores pueden hacerlo (p.2).
- **R-065** Cuando **todos** han terminado de jugar Modificadores, se suman todos los cambios y se ajusta el total (p.2).
- **R-067** Ventana de Modificadores: tras cada tirada empieza una **cuenta regresiva de 5 s** que se **reinicia** cada vez que alguien juega un Modificador. Si pasan 5 s sin ningún Modificador nuevo, la ventana se cierra y la tirada queda fijada. En un **desafío** las dos tiradas comparten ventana, cualquier jugador puede modificar cualquiera de ellas y la cuenta es de **10 s** (D-08, D-09).
- **R-066** Después de usarse, el Modificador va a la pila de descarte (p.2).

## 8. Cartas de Desafío (p.2–3)

- **R-070** Se juega en el turno de **otro** jugador, inmediatamente después de que este **intente jugar** un Héroe, Objeto o Magia desde su mano. No cuesta PA (p.2).
- **R-071** El que desafía y el desafiado tiran 2d6 cada uno. Ambas tiradas admiten Modificadores (R-063) (p.2).
- **R-072** Si la tirada del que desafía es **≥** que la del desafiado (el desafiado solo gana si saca estrictamente más, D-10), la carta desafiada va a la pila de descarte y **no** se recupera el PA (p.2).
- **R-073** Si la del desafiado es **mayor**, su carta se juega con normalidad (p.2).
- **R-074** Cada carta jugada solo puede ser desafiada **una vez**: no se pueden jugar más Desafíos contra la misma jugada (p.2). La carta de Desafío no se puede desafiar (D-10).
- **R-075** La carta de Desafío va a la pila de descarte inmediatamente, sea cual sea el resultado (D-11).
- **R-076** Si un Héroe desafiado se juega con normalidad, la tirada inmediata de R-032 se hace después de resolver el desafío.

## 9. Líderes de Grupo (p.2–3)

- **R-080** No son Héroes y no cuentan para requisitos de "Héroe de cualquier clase" (p.2, p.3).
- **R-081** Sí aportan su clase al Grupo, tanto para requisitos de clase de Monstruos como para el Grupo completo (p.2, p.3, p.3 "incluida tu carta de líder").
- **R-082** Su habilidad se aplica **cada vez** que se cumple su condición, sin límite por turno (p.2).
- **R-083** Si no usas una habilidad opcional en el momento en que se cumple la condición, ya no puedes usarla después (p.3).
- **R-084** El Líder no puede ser sacrificado, destruido, arrebatado ni devuelto a la mano (p.3).

## 10. Monstruos (p.3)

- **R-085** Solo se pueden atacar los Monstruos boca arriba del centro. Cuesta 2 PA (p.3).
- **R-086** Requisitos: cada símbolo debe cubrirse con una carta distinta del Grupo. Un símbolo de clase se cubre con un Héroe **o el Líder** de esa clase; un símbolo "H" solo con un Héroe de cualquier clase (nunca con el Líder). Una misma carta no cubre dos símbolos (p.3).
- **R-087** Al atacar se tira 2d6 (con Modificadores):
  - dentro del rango de éxito → MATAS el Monstruo;
  - dentro del rango de fracaso → pagas la penalización y el Monstruo sigue en el centro;
  - en otro valor → no pasa nada.

  En ningún caso se recuperan los PA (p.3). → D-13

- **R-088** El Monstruo matado va a tu Grupo, junto al Líder, y su habilidad pasa a funcionar como una habilidad de Líder (R-082, R-083) durante el resto de la partida. No puede ser arrebatado, destruido, atacado ni devuelto a la mano (p.3).
- **R-089** Tras matar un Monstruo se pone boca arriba otro del mazo de Monstruos (p.3). Si el mazo de Monstruos está vacío, no se repone (D-14).

## 11. Victoria (p.1, p.3, ref)

La partida se juega con uno de dos modos de reglas, elegido al crearla (D-15).

**Modo normal**

- **R-090** Gana quien **MATE 3 Monstruos**, en el momento de matar el tercero (D-15).
- **R-091** O quien **termine su turno** con un Grupo completo: su Grupo, **incluido el Líder**, representa las **6 clases distintas**. Las clases de los Héroes se evalúan teniendo en cuenta las máscaras (R-046).

**Modo difícil** (D-15, D-20)

- **R-092** Gana quien termine su turno con **6 clases + al menos 1 Monstruo**.
- **R-093** O quien tenga **4 Monstruos + al menos 3 clases**: se comprueba al matar un Monstruo y al terminar el turno.

## 12. Mazo y descarte

- **R-095** Si hay que robar y el mazo está vacío, se **baraja la pila de descarte** y pasa a ser el nuevo mazo. El juego sigue sin penalización (D-16, decisión del usuario).
- **R-097** SACAR una carta de la mano de otro jugador: el jugador activo ve solo los **reversos** de esa mano, en un orden barajado, y elige uno. Solo si la carta lo dice expresamente (p. ej. _Silent Shadow_: "mira la mano… elige") puede ver el contenido antes de elegir (D-12, decisión del usuario).
- **R-096** La pila de descarte está boca arriba y es pública (p.3).

## 13. Efectos de carta (Fase 2)

- **R-100** El efecto de un Héroe se resuelve al superar su tirada (R-031); el de una Magia, al no
  ser desafiada o superar el desafío (R-051). Los objetivos se eligen al resolverse (D-19).
- **R-101** Si un paso del efecto no tiene objetivos válidos, ese paso no tiene efecto y el resto
  del efecto continúa.
- **R-102** "Inmediatamente" significa sin coste de PA (R-025). La carta jugada así puede ser
  desafiada (D-39).
- **R-103** Las habilidades de Líderes, Monstruos y Objetos se aplican cada vez que se cumple su
  condición (R-082). Si dicen "puedes", se pregunta al jugador en ese momento (R-083).
- **R-104** Bonos de tirada: se suman al total junto con los Modificadores al cerrar la ventana de
  la tirada. Los de Objetos solo se aplican a la tirada del Héroe que los lleva.
- **R-105** Protecciones:
  - _Terratuga_ y _Mighty Blade_: los Héroes no pueden ser destruidos.
  - _Calming Voice_: los Héroes no pueden ser arrebatados.
  - _Iron Resolve_: tus cartas no pueden ser desafiadas.
  - _Osolechuza Veterano_: tus Objetos no pueden ser desafiados.
  - Los Héroes protegidos no se ofrecen como objetivo.
- **R-106** Reemplazos:
  - _Muñeco Señuelo_: si el Héroe equipado fuera a ser sacrificado o destruido, el Muñeco va al
    descarte en su lugar.
  - _Dientes de Sable Corrupto_: al destruir, puedes arrebatar en su lugar.
- **R-107** _Llave Selladora_: no se puede tirar para usar el efecto del Héroe equipado.
- **R-108** SACAR es a ciegas (R-097). MIRAR una mano o el mazo solo lo ve quien mira.
