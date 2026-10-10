# Documentación de Here to Slay

**Resumen.** Esta carpeta explica la aplicación a gran escala (qué hace cada pieza y cómo encajan)
y al detalle (flujos, contratos, casos límite y cómo añadir algo). Si es tu primera vez, empieza
por [ARQUITECTURA.md](ARQUITECTURA.md); si solo quieres jugar, por el
[README del repositorio](../README.md). El código es la fuente de verdad: cada documento cita los
archivos y nombres reales.

## Índice de documentos

### Para jugar

| Documento                      | Qué es                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| [EN_LINEA.md](EN_LINEA.md)     | Guía práctica del modo en línea: arrancar el servidor, invitar, túnel, desconexión. |
| [DESPLIEGUE.md](DESPLIEGUE.md) | Guía para desplegar el servidor en la nube (Render, plan gratuito) con contraseña.  |
| [ESCRITORIO.md](ESCRITORIO.md) | El ejecutable `HereToSlay.exe`: cómo se genera, qué contiene y cómo funciona.       |

### Reglas

| Documento                          | Qué es                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------- |
| [REGLAS.md](REGLAS.md)             | Las reglas del juego base como especificación, con ids `R-xxx`.           |
| [DUDAS_REGLAS.md](DUDAS_REGLAS.md) | Ambigüedades del reglamento (`D-xx`) y la decisión tomada en cada una.    |
| [GLOSARIO.md](GLOSARIO.md)         | Términos del juego y del código, con enlace al documento que los explica. |

### Arquitectura y código

| Documento                                          | Qué es                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [ARQUITECTURA.md](ARQUITECTURA.md)                 | Visión de conjunto: paquetes, capas, flujo de una acción y decisiones de diseño.         |
| [MOTOR.md](MOTOR.md)                               | `packages/engine`: `reducer`, pila de decisiones, ventanas, tiradas, eventos y vistas.   |
| [CARTAS_Y_EFECTOS.md](CARTAS_Y_EFECTOS.md)         | Esquema de cartas, DSL de efectos, pasivas, `custom` y guía para añadir una carta.       |
| [BOTS.md](BOTS.md)                                 | `packages/bots`: `botFacil`, `botNormal`, el director `jugarPartida` y el simulador.     |
| [ANFITRION.md](ANFITRION.md)                       | `packages/anfitrion`: temporizadores, bots, detenciones, traspaso y desconexión.         |
| [SERVIDOR_Y_PROTOCOLO.md](SERVIDOR_Y_PROTOCOLO.md) | `apps/server` y el protocolo Socket.IO: salas, seguridad, variables de entorno y túnel.  |
| [WEB.md](WEB.md)                                   | `apps/web`: pantallas, `FuenteMesa`, estado, textos, animaciones y accesibilidad.        |
| [PRUEBAS.md](PRUEBAS.md)                           | Estrategia de pruebas: Vitest, simulación, e2e con Playwright, CI y cómo escribir tests. |

## Mapa de lectura

### Quiero instalar y jugar

1. [README del repositorio](../README.md): requisitos, instalación, recursos de las cartas y
   cómo se juega en la pantalla.
2. [ESCRITORIO.md](ESCRITORIO.md), si prefieres un ejecutable con doble clic.
3. [REGLAS.md](REGLAS.md), si necesitas consultar una regla.

### Quiero montar partidas en línea

1. [EN_LINEA.md](EN_LINEA.md): servidor, enlaces de invitación, túnel y problemas habituales.
2. [DESPLIEGUE.md](DESPLIEGUE.md): servidor en la nube (Render) con dirección fija y contraseña,
   útil si tu red bloquea los túneles.
3. [ESCRITORIO.md](ESCRITORIO.md): hacer de servidor con `HereToSlay.exe`.
4. [SERVIDOR_Y_PROTOCOLO.md](SERVIDOR_Y_PROTOCOLO.md): variables de entorno, límites y seguridad.

### Soy desarrollador y llego nuevo

Recorrido recomendado:

1. [ARQUITECTURA.md](ARQUITECTURA.md) y [GLOSARIO.md](GLOSARIO.md): el mapa y el vocabulario.
2. [REGLAS.md](REGLAS.md) y [DUDAS_REGLAS.md](DUDAS_REGLAS.md): qué debe hacer el motor.
3. [MOTOR.md](MOTOR.md) y [CARTAS_Y_EFECTOS.md](CARTAS_Y_EFECTOS.md): cómo lo hace.
4. [ANFITRION.md](ANFITRION.md) y [BOTS.md](BOTS.md): quién mide el tiempo y quién juega solo.
5. [SERVIDOR_Y_PROTOCOLO.md](SERVIDOR_Y_PROTOCOLO.md) y [WEB.md](WEB.md): red e interfaz.
6. [PRUEBAS.md](PRUEBAS.md): cómo se verifica todo y cómo escribir tests.

### Quiero añadir algo

| Quiero añadir…                       | Lee                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Una carta                            | [CARTAS_Y_EFECTOS.md](CARTAS_Y_EFECTOS.md) (guía «añadir o completar una carta»)                                          |
| Una pantalla o un componente de mesa | [WEB.md](WEB.md) («Cómo añadir una pantalla o un componente a la mesa»)                                                   |
| Una opción del anfitrión             | [ANFITRION.md](ANFITRION.md) («Cómo añadir algo»), y si viaja por red, [SERVIDOR_Y_PROTOCOLO.md](SERVIDOR_Y_PROTOCOLO.md) |
| Una regla o aclarar una duda         | [REGLAS.md](REGLAS.md), [DUDAS_REGLAS.md](DUDAS_REGLAS.md) y [MOTOR.md](MOTOR.md)                                         |
| Un comportamiento de los bots        | [BOTS.md](BOTS.md)                                                                                                        |
| Un test                              | [PRUEBAS.md](PRUEBAS.md)                                                                                                  |

### Quiero colaborar

Lee la sección «Contribuir» del [README](../README.md#contribuir) y [CLAUDE.md](../CLAUDE.md), que
recoge las convenciones (TypeScript estricto, textos en español, `TODO(regla) D-xx`) y el flujo de
trabajo con agentes: el orquestador reparte entre `motor-reglas`, `frontend-ux`, `qa`, `revisor` y
`documentador` (que mantiene esta carpeta, con el comando `/documentar`). Cuando un cambio toque la
arquitectura, un contrato o lo que ve el jugador, actualiza el documento correspondiente.

## Normas de esta documentación

- Los nombres de archivos, funciones, tipos y opciones van en `código` y son los del repositorio.
- No se copian textos oficiales de cartas ni del reglamento: se explica qué hace el código.
- Los diagramas están en Mermaid, que GitHub dibuja directamente.
