# Fábrica de agentes · documentación completa

> Estado al 18 de noviembre de 2026. Proyecto personal de Gonzalo Lavín · licencia MIT · repo `github.com/gonzalolavin99/fabrica-oficina`.

## 1. Qué es, en una frase

Un equipo de agentes de IA (sesiones de Claude Code en la nube) que trabaja solo sobre mis proyectos en GitHub: explora el código, propone mejoras, las planifica, las programa, las prueba y las revisa. Yo decido y fusiono desde una app web en el celular o el PC. Nadie fusiona ni publica nada sin mí.

---

## 2. Las piezas

| Pieza | Qué es | Dónde vive |
|---|---|---|
| **Reloj** | Tareas programadas que despiertan al equipo | Nube de Claude (tareas programadas). Mi PC puede estar apagado |
| **Sede del proyecto** (despachador) | Una sesión de Claude Code permanente por proyecto, con acceso solo a ese repo. Corre con Sonnet (barato). No hace el trabajo: revisa qué toca y lanza al puesto que corresponde | Nube de Claude. Hierro y Ceniza: `session_01RhVe32ef89MmQyhjtWifqK` |
| **Puestos** | Subagentes que la sede crea para cada trabajo, cada uno con su modelo. Nacen, trabajan y desaparecen, así no acumulan memoria ni costo | Dentro de la sede |
| **GitHub** | La oficina real: tareas, conversaciones, planes, cambios, revisiones y memoria. Todo queda escrito y auditable | Cada repo de proyecto |
| **Itachi instantáneo** | GitHub Action que responde mis ideas y mensajes en 1-2 minutos y escribe el plan apenas apruebo | `.github/workflows/fabrica-instantaneo.yml` de cada proyecto |
| **Pruebas en la nube** | GitHub Action que instala el motor del proyecto y corre sus pruebas en cada PR | `.github/workflows/pruebas-godot.yml` (Hierro y Ceniza) |
| **Oficina** (app) | Web/PWA donde veo a los agentes y decido todo | `fabrica-oficina.vercel.app`, código en el repo `fabrica-oficina` |
| **Sede central** | La conversación principal con Claude: conecta proyectos, cambia reglas, renueva sedes | Una sesión de Claude Code |

**Cómo se conectan:** el reloj despierta a la sede → la sede lee su manual en GitHub y mira qué hay pendiente → lanza a los puestos → los puestos escriben en GitHub (propuestas, planes, PRs, revisiones, estado en vivo) → la oficina lee GitHub desde mi navegador y me lo muestra → yo apruebo, converso o fusiono desde la oficina, que escribe en GitHub con mi llave → el ciclo sigue.

---

## 3. El equipo

| Nombre | Puesto | Modelo | Qué hace |
|---|---|---|---|
| **Shisui** | Explorador | Sonnet | Recorre código y docs a diario y propone el siguiente paso pequeño, con prioridad (alta, media, baja) y evidencia |
| **Itachi** | Consejero y Arquitecto | Opus | Cuestiona mis ideas (si son buenas, qué objeta, qué matices ve), conversa conmigo cada propuesta y, cuando apruebo, escribe el plan detallado que el Dev ejecuta. También dirige la retro semanal y escribe el dossier de cada proyecto |
| **Sasuke** | Dev | Sonnet | Implementa exactamente el plan (código y pruebas), abre el PR y corrige lo que le devuelvan |
| **Madara** | Revisor | Sonnet en Hierro y Ceniza · Opus en TherapyHub | Revisa cada PR con memoria limpia y da un veredicto |
| **Fugaku** | Seguridad | Opus | Audita cada domingo el proyecto y a la propia fábrica |

**Regla de modelos:** Opus donde se piensa o donde un error es caro; Sonnet donde se ejecuta algo ya decidido. El Dev es Sonnet porque solo ejecuta un plan detallado que escribió Opus.

**El revisor trabaja con memoria limpia, a propósito:** Madara no sabe nada de cómo se hizo el cambio, solo lo que quedó escrito (tarea, plan, diff, pruebas). Así lo revisa como alguien de fuera y no se deja convencer por el razonamiento de quien lo programó.

---

## 4. La cadena

```
Shisui propone → Gonzalo aprueba → Itachi planifica → Sasuke implementa → Madara revisa → Gonzalo fusiona
```

### Reglas de la cadena

1. Cada puesto trabaja en **una cosa a la vez**.
2. Solo toma lo que **ya pasó por el paso anterior**: nadie se salta la cadena ni inventa trabajo fuera de su paso.
3. Siempre **lo más antiguo primero** (orden de llegada a su paso).
4. Cuando termina, **puede tomar lo siguiente** de su cola.
5. **Trabajo en paralelo:** los puestos trabajan a la vez, cada uno sobre una tarea distinta. Mientras Sasuke programa una, Itachi planifica la siguiente y Madara revisa la anterior. Cada uno usa su propia copia del repo (`git worktree`) para no pisarse.
6. **Los agentes no hablan entre ellos.** Lo único que uno sabe del trabajo de otro es lo que quedó escrito en GitHub.

### Etiquetas que mueven la cadena (en los issues de GitHub)

| Etiqueta | Significado | Quién la pone |
|---|---|---|
| `fabrica:propuesta` | Propuesta esperando mi decisión | Shisui o Itachi |
| `prioridad:alta/media/baja` | Prioridad de la propuesta | Shisui o Itachi |
| `fabrica:aprobada` | La aprobé | **Solo yo**, en persona |
| `fabrica:planificando` | Itachi instantáneo está escribiendo el plan | La Action |
| `fabrica:planificada` | Plan listo para Sasuke | Itachi |
| `fabrica:en-curso` | Sasuke la está programando | Sasuke |
| `fabrica:corregir` | Madara se la devolvió a Sasuke | Madara |
| `fabrica:idea` | Idea mía para conversar con Itachi | Yo, desde la oficina |
| `fabrica:activo` | Proyecto en el que trabaja el equipo ahora | Yo, desde la oficina |
| `fabrica:manual` · `fabrica:bitacora` · `fabrica:dossier` · `fabrica:aprendizajes` | Issues especiales de memoria y reglas | La fábrica |

### Paso a paso de una tarea

1. **Nace:** Shisui la propone (turno diario), Itachi la crea a partir de una idea mía, o yo pido una tarea directa.
2. **Converso y decido:** en la oficina leo el «En corto», pregunto en el chat de la tarea, e Itachi responde en 1-2 minutos. Apruebo o rechazo con un toque.
3. **Plan:** apenas apruebo, Itachi instantáneo escribe el plan: archivos, pasos, casos borde, qué no tocar y una sección obligatoria **«Pruebas»** (qué pruebas agregar o ajustar, o por qué no hace falta ninguna).
4. **Código:** en la siguiente ronda, Sasuke crea la rama `fabrica/issue-<n>-<slug>`, implementa el plan con sus pruebas y abre el PR.
5. **Pruebas en la nube:** el PR dispara la Action, que instala el motor (Godot 4.7.2 en Hierro y Ceniza), corre las pruebas y deja un comentario «🤖 Pruebas: ✅…» o la lista de las que fallaron.
6. **Revisión:** Madara espera ese resultado, lee el diff completo y revisa tres cosas: (a) que las pruebas pasen, (b) que el plan pidiera las pruebas correctas, (c) que Sasuke las haya escrito. Su veredicto es uno de estos:
   - **LISTO PARA FUSIONAR** o **CON OBSERVACIONES** → me llega para fusionar.
   - **DEVOLVER A SASUKE** → faltan código o pruebas que pedía el plan, o una prueba falla por el cambio. Sasuke corrige en la misma rama antes de cualquier tarea nueva.
   - **DEVOLVER A ITACHI** → el plan no pedía las pruebas necesarias o está mal. Se cierra el PR y se replanifica.
   - **NO FUSIONAR** → problema grave que necesita mi decisión.
   - Si una tarea se devuelve 2 veces, no se devuelve más: me llega a mí.
7. **Conflictos:** si un PR choca con otro cambio que ya fusioné, Sasuke trae lo último de `main`, lo resuelve conservando ambos cambios y vuelve a pasar por Madara.
8. **Fusión:** yo toco «Fusionar» en la oficina. En TherapyHub eso despliega a producción en Vercel. En Hierro y Ceniza hago `git pull` en mi PC y lo veo con F5.

### Ritmo de trabajo (hora de Chile; la oficina lo muestra en la hora del dispositivo)

| Qué | Cuándo |
|---|---|
| Itachi instantáneo (ideas, mensajes, plan al aprobar) | Al instante, 1-2 minutos |
| **Ronda de trabajo** (Revisor → Dev → Arquitecto → respuestas) | Cada hora, al minuto :44. Sigue sin parar mientras haya trabajo en la cadena |
| Explorador | Todos los días a las 04:43 |
| Seguridad | Domingos 02:12 |
| Retro | Domingos 17:38 |

**Tope de cuota:** máximo 4 tareas completas por día. Las respuestas a mis mensajes no cuentan.

Orden dentro de una ronda: 1) ¿espero respuesta de Itachi?; 2) ¿hay un PR con conflicto?; 2b) ¿hay algo devuelto a Sasuke?; 3) ¿hay un PR sin revisar?; 4) ¿hay algo planificado sin programar?; 5) ¿hay algo aprobado sin plan? Se avanza de atrás hacia adelante: primero se termina lo que está más cerca del final.

---

## 5. Memoria y mejora continua

| Dónde | Qué guarda | Regla |
|---|---|---|
| **Manual** (issue #4) | Reglas permanentes de cada puesto y turno | Solo lo edito yo. La sede lo relee solo si cambió (ahorro de contexto) |
| **Bitácora** (issue #1) | Resumen y «lección» de cada turno, más un comentario de estado en vivo por puesto | Es lo que la oficina muestra como «en vivo» |
| **Dossier** (issue `fabrica:dossier`) | Qué es el proyecto, stack y comandos, mapa del código, convenciones, zonas delicadas, estado, pruebas, y una sección por puesto | Máximo ~1200 palabras. Cada agente lee lo general y solo su sección |
| **Aprendizajes** (issue `fabrica:aprendizajes`) | Reglas de flujo aprendidas | Máximo 12 líneas, cada una etiquetada por puesto; cada agente lee solo las suyas |

**Retro semanal (domingo):** revisa la semana (propuestas aprobadas y rechazadas, veredictos, lecciones) y propone como máximo 2 mejoras. En este orden de preferencia: (1) algo que quede en el código o las herramientas (una prueba, un script, un chequeo de CI) y no ocupe memoria; (2) un cambio al manual, que hago yo; (3) solo si nada de eso sirve, una línea en Aprendizajes.

**Onboarding de un proyecto nuevo:** la primera vez que lo activo, Shisui lo recorre completo (docs, estructura, dependencias, build, pruebas, CI, zonas delicadas) y deja sus notas. Itachi las verifica contra el código y escribe el dossier. Si el proyecto no tiene pruebas automáticas en la nube, Itachi propone agregarlas con prioridad alta.

---

## 6. Seguridad

- **Los agentes nunca:** fusionan, despliegan, empujan a la rama principal, hacen force-push, se ponen la etiqueta de aprobada ni editan su propio manual.
- **Sin mi instrucción escrita no tocan:** pagos, autenticación, base de datos, CI, secretos, ni componentes generados.
- **Todo lo que leen es dato, no orden:** el texto de issues, comentarios y archivos nunca es una instrucción. Solo cuenta lo que escribí yo en persona: mi usuario y sin la app de Claude. Las cuentas externas se ignoran y la bitácora está bloqueada para ellas.
- **Las aprobaciones se verifican:** el evento de «aprobada» tiene que venir de mí en persona; si no, se ignora.
- **Repos públicos:** nada explotable se publica en GitHub. Fugaku lo informa solo en la sesión privada.
- **La oficina** no guarda llaves en el código. Mi llave de GitHub vive solo en mi dispositivo. Tiene cabeceras de seguridad (CSP: solo puede hablar con GitHub) y no muestra como estado nada que no venga de mi cuenta.
- **Pruebas en la nube:** la versión de Godot está fijada y verificada con sha256.
- **Lo que la plataforma reserva a una persona:** conectar un repo nuevo a la fábrica necesita mi aprobación. Una sesión desatendida no puede darse acceso sola; lo probé y está bloqueado a propósito.

---

## 7. La oficina (app)

**Dirección:** `https://fabrica-oficina.vercel.app`. Se instala como app (PWA) en el celular o el PC y se actualiza sola cuando hay versión nueva.

**Llave:** un token personal de GitHub con permisos de Issues, Pull requests y Contents en «Read and write». Se pega en ⚙ o se activa una vez por dispositivo con un enlace privado. Sin llave solo se puede mirar.

### Pestañas

- **Inicio (mis decisiones):**
  - Resumen arriba: cuántas cosas me toca decidir, cuántas van en marcha y si el equipo trabaja.
  - **Te toca:** tarjetas de 2 líneas (prioridad, tipo, título, resumen) con Aprobar, Ver y ✕, o Fusionar si Madara ya revisó. Filtros: Todo · Propuestas · Para fusionar · Ideas. Ordenadas de la más antigua a la más nueva (FIFO).
  - **En marcha:** cada tarea con su barra de fases **Aprobada → Plan → Código → Revisión → Tuya**, quién la tiene y cuándo avanza. Si Madara la devolvió o choca con otro cambio, lo dice.
- **Oficina:**
  - Escena pixel vista desde arriba, en estilo **Pixel** u **Oscuro** (negro y carmesí, sprites estilo anime con ojos rojos).
  - Quien trabaja está en su escritorio con un ícono de lo que hace (leyendo, escribiendo, ejecutando, pensando) y una barra de avance. Los libres toman café, juegan consola, leen o riegan la planta.
  - Debajo, un agente por línea con su estado: **Trabajando**, **Pronto**, **Tú** o **Libre**.
  - Su ficha muestra en grande qué hace ahora, su último trabajo, qué sigue, qué hizo paso a paso (plegado) y «Hablarle ahora».
- **Ideas (mesa del CEO):** escribo una idea e Itachi me responde en 1-2 minutos con su opinión corta. Abajo están las conversaciones abiertas y, plegado, «Pedir una tarea directa» (entra aprobada, sin pasar por Itachi).
- **Ayuda:** la cadena en 4 pasos y la explicación completa plegada.

### Vista de una tarea

Pantalla completa: título, etiquetas, barra de fase y, si ya está en la cadena, «✓ No tienes que hacer nada: avanza solo». Luego:

- **En corto:** qué verás, por qué ahora, cómo probarlo.
- La opinión de Itachi o el veredicto de Madara en una línea.
- Plegados: cambios de código (diff por archivo), plan de Itachi, detalle técnico completo.
- Chat de la tarea.

Los botones de decisión quedan **fijos abajo**.

### Chat por tarea

Cada tarea tiene su propio chat, para que no se mezcle todo. Las burbujas muestran la primera frase de cada agente con «Ver completo». Escribo abajo y responde Itachi.

### Proyectos

Toco el proyecto arriba para elegir en cuál trabaja el equipo (uno a la vez), ver «Qué saben de él» (el dossier) y la bitácora, o **agregar un proyecto** con el link del repo, un nombre y un color. Queda «por conectar» hasta que la sede central lo conecta.

### Detalles

- Spinner y aviso «Guardando…» en cada acción.
- Mensajes de confirmación.
- Botones que se bloquean para no enviar dos veces.
- Sonido opcional cuando llega algo nuevo.
- Se actualiza cada 45 segundos si alguien trabaja y cada 3 minutos si no.
- Horarios en la hora de mi dispositivo.
- Si un PR tiene conflicto, no ofrece «Fusionar».

**Técnica:** HTML, CSS y JavaScript sin build ni servidor propio (`index.html`, `app.js`, `scene.js`, `style.css`, `sw.js`, `proyectos.json`). Lee y escribe directo en la API de GitHub desde el navegador. Desplegada en Vercel, que publica sola cada cambio del repo.

---

## 8. Cómo se cuida la cuota

- Opus solo donde vale la pena. Sonnet para despachar, explorar y programar.
- La sede no hace el trabajo: lanza subagentes que desaparecen al terminar, así su conversación crece poco.
- **Un proyecto activo a la vez.** Los proyectos en pausa tienen sus turnos apagados (cero costo).
- La sede no relee el manual si no cambió.
- Las rondas terminan al instante si no hay trabajo.
- Máximo 2 propuestas diarias y 4 tareas completas por día.
- Aprendizajes con tope de 12 líneas.
- **Renovar la sede cada semana:** una sesión nueva con el contexto limpio. No se pierde nada, porque la memoria vive en GitHub.

---

## 9. Lo que hemos hecho

### La fábrica (16-18 de noviembre)

1. Diseño inicial: tablero en GitHub, roles, fases de autonomía y controles de seguridad.
2. Primera versión: dos tareas programadas al día. **Falló:** las sesiones nuevas no tenían permiso sobre los repos. Rediseño con sesiones permanentes por proyecto.
3. Detecté que «aprobado por Gonzalo» no se distinguía de los agentes (escriben con mi usuario). Ahora una aprobación solo vale si no pasó por la app de Claude.
4. Despachador barato (Sonnet) más subagentes por puesto. El manual vive en el issue #4 y se relee en cada despertar.
5. Organigrama ajustado contigo: el Arquitecto en Opus, el Dev en Sonnet, Seguridad y Retro semanales, y la regla de que los agentes no hablan entre ellos.
6. Un solo equipo y un proyecto activo a la vez. Turnos apagados en los proyectos en pausa (TherapyHub costaba cuota solo para decir «en pausa»).
7. De turnos fijos a **flujo continuo**: ronda cada hora que no para hasta vaciar la cadena, con puestos en paralelo y cada uno en su copia del repo.
8. Onboarding con dossier para cada proyecto nuevo. El de Hierro y Ceniza tiene 1201 palabras, verificado contra el código.
9. **Itachi instantáneo** con GitHub Actions y mi token de Claude: responde en 1-2 minutos y planifica al aprobar.
10. **Pruebas en la nube:** Godot 4.7.2 corre las pruebas en cada PR. 28 pasan; 10 se omiten porque necesitan las animaciones Mixamo, que no están en el repo por licencia (`game/tests/ci_omitir.txt`).
11. Madara verifica las pruebas y puede devolver la tarea a Itachi o a Sasuke. Sasuke resuelve conflictos solo.
12. Los agentes escriben para el celular: «En corto» al inicio de cada propuesta y PR, y frases cortas.
13. Seguridad endurecida: bitácoras bloqueadas, la oficina ignora a cuentas ajenas y PRs de forks, CSP, y la llave fuera del código.

### La oficina

Versión 1 (dos salas) → oficina vista desde arriba con agentes que caminan → estilo Oscuro con el equipo Uchiha y sprites propios → bandeja FIFO con filtros → todo dentro de la app (leer, conversar, aprobar, fusionar, cambiar de proyecto) → agregar proyectos desde la app → «En marcha» con fases → loader → **rediseño completo** (Inicio con mis decisiones, oficina con fichas cortas, un chat por tarea) a partir de 3 maquetas.

### Hierro y Ceniza (Hito 9, el Paso de Hierro)

| PR | Qué |
|---|---|
| #7 | Paso 4.1 · Los soldados de la aldea avisan antes de atacar («¡Atrás!») |
| #8 | Paso 4.2 · Primeros aldeanos con su frase; fuera el cartel provisional |
| #9 | Docs al día: README, créditos (Mixamo, Kokoro, audio propio), índice y estado |
| #17 | Paso 4.3 · El desertor que se rinde y lleva agua al pozo si se le perdona |
| #19 | Paso 4.4 · La lista de raciones en un morral junto al pozo |
| #20 | Paso 4.5 · Segunda frase de los aldeanos tras vencer a Varga |
| #22 | Paso 4.6 · La promesa del prólogo cambia lo que dicen la niña y la madre |
| #16 | Infraestructura · Itachi instantáneo |
| #18 | Infraestructura · Pruebas en la nube (**pendiente de fusionar**) |

En curso: **#23** (prueba automática de aldeanos, promesa y desertor) y **#24** (docs al día del Hito 9).

---

## 10. Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Oficina | `https://fabrica-oficina.vercel.app` |
| Código de la oficina | `github.com/gonzalolavin99/fabrica-oficina` |
| Lista de proyectos | `proyectos.json` en ese repo |
| Plantilla del manual | `docs/manual-agentes.md` en ese repo |
| Manual vivo de cada equipo | Issue #4 de cada proyecto |
| Bitácora y estado en vivo | Issue #1 de cada proyecto |
| Dossier | Issue con etiqueta `fabrica:dossier` (en Hierro y Ceniza, #5) |
| Itachi instantáneo y pruebas | `.github/workflows/` de cada proyecto |
| Sedes de los equipos | App de Claude → Code → «Fábrica · hierro-y-ceniza» y «Fábrica · speech-therapy-hub» |
| Horarios | App de Claude → tareas programadas que empiezan con «Fábrica ·» |
| Guía en PDF | `docs/Fabrica-como-funciona.pdf` en el repo de la oficina |

## 11. Pendientes

1. Fusionar **PR #18** (pruebas en la nube) desde GitHub. Desde la app no se puede porque cambia workflows.
2. Decidir si se activan **pruebas nuevas** en Hierro y Ceniza. Recomendado: sí, una pequeña por paso.
3. Que alguien de fuera **juegue un `.exe`** con la aldea, como recomendó Itachi.
4. **Renovar las sedes** una vez por semana.
5. Más adelante: un backend en Go si la fábrica crece (webhooks, chat en tiempo real, métricas).
