# CLAUDE.md — Instituto Rubí | Sistema de landings SEO

> Instrucciones permanentes para Claude Code. Leer este archivo antes de planificar, crear o modificar código o contenidos. **Este documento define el objetivo y las reglas del proyecto, no certifica que la infraestructura ya esté configurada.**

## 1. Contexto y objetivo

Instituto Rubí es una clínica de cirugía estética. El proyecto consiste en reconstruir y mantener sus landings de tratamientos y localidades a partir de diseños aprobados en Figma, utilizando **Astro + Claude Code + GitHub**.

El objetivo es que el equipo SEO pueda preparar nuevas landings en **Excel y/o Word** y que un proceso reproducible las convierta en páginas, sin tener que maquetarlas individualmente.

**Uso de las landings:** solo tráfico de **campañas de pago** (anuncios). No son páginas SEO: todas son `noindex` y no entran en ningún sitemap (decisión de Fase 2, ver `docs/fase-2-plan.md`).

Sitios de referencia (no asumir que su contenido está actualizado):
- Web principal: https://institutorubi.com/
- Primera landing que se va a reconstruir: https://aumento-pecho-aba.drcarlosrubi.com/

**Idioma editorial:** castellano de España. Respetar cualquier contenido en otro idioma cuando esté marcado explícitamente como tal.

## 2. Decisiones ya acordadas

- **Framework:** Astro.
- **Asistencia de desarrollo:** Claude Code.
- **Diseño:** Figma, con componentes, tokens y variables aprobados. Acceder a los frames y tokens mediante Figma MCP cuando esté disponible.
- **Código y revisiones:** GitHub.
- **Fuentes para nuevas landings:** ficheros Excel (`.xlsx`/`.csv`) y Word (`.docx`).
- **Destino de URLs:** un único subdominio para todas las landings, `tratamiento.institutorubi.com`, independiente del WordPress del dominio principal. No crear un subdominio por landing.
- **Modelo de generación:** plantillas y componentes reutilizables; los datos de cada landing quedan separados de la presentación.
- **Publicación:** despliegue revisado en **Vercel Pro** desde GitHub (previews por PR). Formularios: Supabase (leads), Resend (notificaciones) y Cloudflare Turnstile (anti-spam). Ver `docs/fase-2-plan.md` y `docs/despliegue.md`.

No introducir WordPress/ACF como CMS obligatorio ni sustituir Astro sin autorización expresa.

## 3. Arquitectura de URLs

Patrón en el subdominio `tratamiento.institutorubi.com` (prefijo configurable con `PUBLIC_LANDINGS_BASE`, vacío por defecto):

```text
/{tratamiento}/
/{tratamiento}/{localidad}/
```

Ejemplos ilustrativos, no afirmaciones de que esas localidades se atiendan:

```text
/aumento-pecho/
/aumento-pecho/mallorca/
/rinoplastia/barcelona/
```

Rutas reservadas por la aplicación (ninguna landing puede empezar por ellas): `api`, `gracias`, `404`.

Reglas:
- Slugs en minúscula, sin tildes, con guiones y barra final según la configuración del proyecto.
- Una sola URL por landing; evitar duplicados.
- No crear páginas de localidad simplemente cambiando el topónimo: exigir valor local diferenciador y verificado.
- No crear páginas para servicios/localidades no confirmados.
- Registrar y validar cualquier cambio de slug. **Nunca borrar, renombrar ni redirigir URLs antiguas automáticamente**.
- Para migraciones, generar un mapeo explícito `URL antigua → URL nueva`, revisable antes de aplicar redirecciones 301.

## 4. Diseño y maquetación

1. Tratar el diseño aprobado de Figma como referencia visual y estructural.
2. Leer las variables/tokens existentes; no inventar colores, fuentes, espaciados o estilos alternativos cuando los originales estén disponibles.
3. Convertir las secciones repetibles en componentes Astro reutilizables (hero, beneficios, proceso, profesionales, preguntas frecuentes, formulario, CTA, etc.). No asumir que todas las landings requieren todas las secciones.
4. Respetar desktop, tablet y móvil, así como estados interactivos.
5. Utilizar HTML semántico, componentes accesibles, textos alternativos y controles utilizables con teclado.
6. Optimizar Core Web Vitals: imágenes responsivas y comprimidas, dimensiones explícitas, carga diferida cuando corresponda y JavaScript mínimo.
7. No añadir dependencias, librerías UI ni animaciones innecesarias sin justificarlo.
8. Antes de cambiar un componente compartido, evaluar qué otras landings se verán afectadas.

Si faltan el enlace al archivo/frame de Figma, permisos MCP o tokens, comunicar exactamente qué falta. No fingir haber consultado el diseño.

## 5. Modelo de contenidos

Separar tres niveles de información:

1. **Tratamiento:** información clínica compartida, beneficios descritos con cautela, procedimiento, riesgos, recuperación y FAQs generales, siempre validados por el equipo competente.
2. **Localidad/sede:** dirección, datos de contacto, profesionales, disponibilidad del servicio e información local confirmada.
3. **Landing específica:** intención de búsqueda, H1, introducción y bloques propios, title, description, FAQs locales y recursos concretos.

Una landing debe **referenciar** contenidos compartidos, no duplicarlos físicamente cuando sea posible. Las excepciones locales prevalecen solo cuando se documentan y validan.

Definir y mantener un esquema tipado (por ejemplo, Zod/content collections de Astro) para validar las entradas. Los nombres exactos de carpetas y campos deben adaptarse al repositorio existente; no asumir que ya existe esta estructura.

## 6. Importación masiva desde Excel y Word

### Principio

**Claude Code ayuda a diseñar y mantener el importador; las importaciones habituales deben realizarse mediante scripts deterministas, repetibles y verificables.** No depender de prompts distintos para cada lote.

### Formato inicial sugerido

El Excel actúa como índice de landings. Columnas recomendadas:

| Campo | Uso |
|---|---|
| `id` | Identificador estable de la landing |
| `tratamiento_slug` | Referencia a un tratamiento existente |
| `localidad_slug` | Localidad; vacío para landing general |
| `url_destino` | Ruta propuesta; validada contra el patrón de URLs |
| `h1` | Encabezado principal |
| `seo_title` | Title SEO |
| `meta_description` | Descripción SEO |
| `intro` | Introducción o referencia a documento fuente |
| `documento_fuente` | Ruta relativa al `.docx`, si aplica |
| `imagen_principal` | ID/ruta de un recurso autorizado |
| `datos_locales_fuente` | Referencia verificable de información local |
| `estado` | `borrador`, `pendiente_revision`, `aprobado` |

No dar por definitivo este esquema hasta validar el primer Excel real con el equipo SEO.

### Comportamiento del importador

1. Leer los archivos de entrada y extraer su contenido sin alterar los originales.
2. Normalizar slugs y validar que las referencias a tratamiento y localidad existan.
3. Detectar filas duplicadas, URLs repetidas, campos obligatorios ausentes y archivos enlazados inexistentes.
4. Asociar el contenido del Word a la landing correcta mediante una referencia explícita, nunca por parecido del nombre.
5. Generar **datos estructurados** compatibles con las plantillas de Astro. No producir páginas HTML independientes por cada fila.
6. Mantener IDs estables para que las reimportaciones actualicen los registros correctos sin duplicarlos (**idempotencia**).
7. Preservar revisiones o cambios editoriales manuales posteriores; no sobrescribirlos sin advertir del conflicto.
8. Crear un informe de importación con registros creados, modificados, omitidos, errores y avisos SEO/médicos.
9. Ejecutar primero una vista previa (`dry-run`) y exigir revisión antes de escribir cambios masivos.
10. Dejar las landings nuevas como **borrador/no publicables** hasta recibir aprobación editorial y médica cuando corresponda.

Un Word puede contener contenido largo y secciones; si su estructura es ambigua, generar incidencias para revisión en lugar de inventar cómo mapearlo.

## 7. Reglas SEO y de anuncios obligatorias

Las landings son para campañas de pago y **siempre `noindex`** (meta robots + cabecera `X-Robots-Tag`). No bloquear el rastreo en `robots.txt`: Google y AdsBot deben poder leer el `noindex` y revisar la página de destino. Las reglas siguientes siguen aplicando a la calidad del contenido:

- Cada landing debe responder a una intención propia y ofrecer contenido útil y suficientemente diferenciado.
- El equipo SEO define keywords, intención, estructura editorial, title y metadescripción; Claude puede proponer mejoras, pero no darlas por aprobadas.
- Mantener un solo H1 principal, jerarquía H2/H3 lógica, enlaces internos relevantes y breadcrumbs cuando proceda.
- Generar canonical absoluto correcto (`PUBLIC_SITE_URL`) y mantener `noindex`; no generar sitemap.
- Evitar páginas puerta (*doorway pages*), contenido local superficial, contenido repetido y keyword stuffing.
- No fabricar direcciones, clínicas, horarios, médicos ni servicios disponibles en un lugar.
- Los datos estructurados (`schema.org`) solo deben reflejar contenido visible y hechos verificados; no inventar reseñas, puntuaciones ni FAQs.
- Si una URL antigua va a migrarse, registrar metadatos, tráfico/relevancia disponible, destino propuesto y necesidad de 301; cualquier redirect debe aprobarse.
- Diferenciar claramente entorno de pruebas y producción; las previsualizaciones no deben indexarse.

## 8. Precauciones médicas y legales

Es contenido sobre cirugía estética: aplicar revisión especialmente estricta.

- No inventar ni exagerar resultados, porcentajes de éxito, plazos de recuperación, ausencia de riesgos, certificaciones o experiencia médica.
- Evitar promesas absolutas como «sin riesgos», «resultados garantizados» o «recuperación asegurada».
- Cualquier afirmación clínica relevante, imágenes antes/después, testimonio, identidad profesional o información de una sede debe contar con fuente y aprobación adecuadas.
- Los textos sanitarios requieren revisión humana cualificada antes de publicarse. Claude no sustituye el criterio médico ni la revisión de publicidad sanitaria aplicable.
- No incluir datos personales de pacientes en el repositorio, Excel de trabajo o prompts; gestionar consentimientos y privacidad.
- No utilizar fotografías de pacientes sin autorización verificable.
- No copiar automáticamente afirmaciones de las landings antiguas sin contrastarlas.

## 9. Convenciones de desarrollo

- Priorizar el código claro, mantenible y tipado cuando corresponda.
- Reutilizar estructuras y utilidades existentes antes de crear otras nuevas.
- Documentar nuevas variables de entorno y dependencias; nunca guardar secretos, tokens ni credenciales en Git.
- No realizar operaciones destructivas, despliegues a producción, cambios DNS, redirecciones o modificaciones de infraestructura sin aprobación explícita.
- Trabajar en ramas descriptivas y preparar cambios fáciles de revisar mediante pull requests.
- No afirmar que las pruebas han pasado si no se han ejecutado; registrar comandos y resultados.
- En cada cambio importante, indicar qué archivos han cambiado y qué landings se ven afectadas.

## 10. Comprobaciones antes de entregar

Siempre que el proyecto disponga de las herramientas correspondientes:

- [ ] Validación de esquema y ausencia de duplicados.
- [ ] Build de Astro sin errores.
- [ ] Links internos y rutas generadas válidos.
- [ ] H1, title, meta description y canonical coherentes.
- [ ] Páginas no aprobadas excluidas de publicación/indexación.
- [ ] Revisión responsive y contraste con el diseño de Figma.
- [ ] Accesibilidad básica (semántica, etiquetas, teclado, alt).
- [ ] Rendimiento e imágenes optimizadas.
- [ ] Formularios/CTAs comprobados en el entorno de pruebas.
- [ ] Revisiones SEO y médica marcadas como pendientes o aprobadas; no presumir aprobaciones.
- [ ] Informe de importación y listado de URLs generadas.

## 11. Primer hito y criterios de aceptación

**Piloto:** reconstruir la landing de aumento de pecho ABA a partir de su frame de Figma aprobado y de contenidos validados.

Objetivos del piloto:
1. Construir componentes y tokens compartidos en Astro.
2. Separar datos de tratamiento, localidad y landing.
3. Probar una página general y al menos dos variantes de localidad **solo con datos reales aportados y aprobados**; si aún no existen, utilizar fixtures ficticios expresamente no publicables.
4. Importar un Excel de prueba con control de errores y `dry-run`.
5. Generar un listado de rutas y una previsualización revisable.
6. Verificar que añadir una localidad nueva no exige modificar componentes ni maquetar manualmente.

**Definición de terminado:** una nueva fila válida en Excel puede crear una landing en estado borrador, usando la plantilla existente, con informe de validación y sin cambios manuales en la maquetación.

## 12. Cómo debe responder Claude Code en este repositorio

Antes de implementar un cambio significativo:
1. Revisar la estructura real del repositorio y los archivos de configuración pertinentes.
2. Identificar las dependencias y piezas ya existentes; no asumir que el proyecto se ha iniciado.
3. Explicar brevemente el plan y las implicaciones para otras landings.
4. Si falta un dato esencial (acceso a Figma, Excel, fuente médica, configuración de despliegue), explicitar la dependencia y avanzar solo con lo que sea seguro.

Al terminar:
- Resumir cambios realizados.
- Enumerar comprobaciones ejecutadas y pendientes.
- Informar de las URLs añadidas/modificadas y de cualquier riesgo SEO o médico.
- Indicar qué debe validar el equipo SEO, el equipo web y, cuando proceda, el responsable médico.

## 13. Responsabilidades

- **Equipo SEO:** intención de búsqueda, arquitectura editorial, selección de localidades, contenidos, metadatos, enlaces internos y aprobación SEO.
- **Equipo web:** componentes, importador, rendimiento, accesibilidad, despliegues e integración con la web actual.
- **Responsable médico/cliente:** validación de información clínica, profesionales, recursos y afirmaciones publicitarias.
- **Claude Code:** apoyo a desarrollo y transformación de datos; no aprueba contenidos ni publica por iniciativa propia.

---

**Prioridad del proyecto:** coherencia visual + SEO útil + seguridad editorial + generación masiva fiable. La velocidad no debe conseguirse a costa de inventar información, multiplicar páginas duplicadas o publicar contenido sin revisar.
