# Auditoría de seguridad de halla.ink

**Fecha:** 4 de octubre de 2026 · **Tipo:** prueba de caja blanca (revisión de código y explotación de cada
hallazgo en un entorno de prueba) · **Alcance:** base de datos y políticas RLS, Edge Functions, frontend,
tratamiento de datos personales, secretos y cadena de suministro.

## Resumen

halla maneja datos personales de los auditores (nombre, cédula, celular) y, potencialmente, información de
salud que los auditores describen en sus hallazgos. La auditoría encontró **11 problemas**: uno crítico,
tres altos, seis medios y uno bajo que agrupa varios ajustes. **Todos se corrigieron en el código** y cada
uno quedó como prueba automática de regresión: si alguien reintroduce el problema, una prueba falla.

Quedan **acciones que no son de código** (configuración del proyecto, contratación y validación jurídica)
que deben completarse antes de cargar datos reales: ver [Antes de producción](#antes-de-producción).

| ID | Gravedad | Hallazgo | Estado |
|---|---|---|---|
| S1 | **Crítica** | Texto con posibles datos de pacientes enviado al nivel gratuito de Gemini | Mitigado en código · **requiere nivel pago** |
| S2 | **Alta** | Registro abierto: cualquiera en internet obtenía acceso y gastaba la cuota de IA | Corregido |
| S3 | **Alta** | Citas normativas falsificables y borrado o antedatado de registros | Corregido |
| S4 | **Alta** | Límite de uso de IA evadible con peticiones en paralelo; sin límite por minuto | Corregido |
| S5 | Media | Sin Content Security Policy ni protección contra *clickjacking* | Corregido |
| S6 | Media | Contraseña mínima de 6 caracteres en el servidor | Corregido · **aplicar configuración** |
| S7 | Media | El registro revelaba si un correo ya existía (enumeración de cuentas) | Corregido |
| S8 | Media | Sesiones sin cierre por inactividad en computadores compartidos | Corregido |
| S9 | Media | Sin autorización de tratamiento de datos personales (Ley 1581 de 2012) | Corregido · **validación jurídica** |
| S10 | Media | Errores internos de la base de datos y de Google mostrados al usuario | Corregido |
| S11 | Baja | Topes de tamaño, privilegios sobrantes, CI sin fijar, redirección sin validar | Corregido |

---

## S1 · Datos sensibles enviados al nivel gratuito de Gemini — Crítica

**Problema.** El auditor describe lo que observó con texto libre, y en un hospital es esperable que escriba
«la paciente María Pérez, HC 1234567…». Ese texto se enviaba completo a Gemini. Los términos de uso de
Gemini dicen, para el nivel **gratuito** (consultados el 4/10/2026 en ai.google.dev/gemini-api/terms):

> «Google uses the content you submit to the Services and any generated responses to provide, improve, and
> develop Google products and services» · «human reviewers may read, annotate, and process your API input
> and output» · **«Do not submit sensitive, confidential, or personal information to the Unpaid Services.»**

En el nivel **pago**, Google no usa los datos para mejorar sus productos y solo los registra por un tiempo
limitado para detectar abusos. Los datos de salud son datos sensibles en la Ley 1581 de 2012, y la historia
clínica es reservada.

**Corrección.**
- **Anonimización en el servidor** (`supabase/functions/_shared/anonimizar.ts`). Antes de cualquier llamada
  a la IA se retiran correos, celulares, teléfonos fijos, números de cédula, de historia clínica y de
  documento (con o sin etiqueta, con o sin puntos), y los nombres que siguen a palabras como «paciente»,
  «señora», «niño», «Dr.», «auxiliar» o «jefe de enfermería». A Google llega «La paciente [nombre retirado],
  HC [número retirado]…». La base de datos propia conserva el texto original, necesario para la trazabilidad.
  Se aplica al hallazgo, a las notas, al título de la auditoría y a los hallazgos que se envían para redactar
  el informe.
- **Aviso en la pantalla de captura:** «No escribas datos de pacientes…».
- El auditor ve cuántos datos se retiraron, y cada hallazgo guarda ese conteo en su trazabilidad.

**Verificación.** `pnpm probar:validacion`, sección «Anonimización»: nombres compuestos («Santiago de la
Cruz»), cargos en mayúscula («La Auxiliar Ana Gómez»), documentos y teléfonos se retiran, y el contenido
legítimo de auditoría (cifras, montos en pesos, normas, servicios, la institución) no se altera.

**Riesgo residual.** La anonimización es una defensa en profundidad, no una garantía: un nombre propio que
no siga a una palabra de rol («Pérez no firmó») no se detecta. **La corrección de fondo es activar la
facturación de Google AI Studio (nivel pago) antes de usar la plataforma con datos reales.**

## S2 · Registro abierto — Alta

**Problema.** Cualquier persona en internet podía crear una cuenta en halla.ink y, con ella, consultar las
normas, crear auditorías y consumir la cuota de IA compartida por todo el hospital (20 solicitudes diarias
por modelo en el nivel gratuito). La RLS impedía ver datos ajenos, pero no impedía entrar.

**Corrección** (migración `0006_seguridad.sql`):
- Todo perfil nace **sin aprobar** (`profiles.aprobado = false`) y el servidor lo fuerza aunque el cliente
  envíe otra cosa. Las políticas RLS de auditorías, hallazgos, informes y normas exigen
  `usuario_activo()`; las Edge Functions responden 403 a cuentas sin aprobar.
- Un administrador aprueba o desactiva cuentas desde **Auditores** (`/app/admin/auditores`) con la función
  `aprobar_auditor`, que verifica en la base de datos que quien llama es admin y registra quién aprobó y
  cuándo. Nadie puede aprobarse a sí mismo ni un admin puede desactivarse a sí mismo.
- Un admin desactivado pierde el acceso de inmediato.

**Verificación.** `pnpm probar:bd` (sección «Cuenta sin aprobar») y `pnpm probar:interfaz` («Controles de acceso»).

## S3 · Integridad y trazabilidad de los registros — Alta

**Problema.** Explotado con un usuario autenticado legítimo sobre sus propios datos:

| Ataque | Antes | Ahora |
|---|---|---|
| Editar un hallazgo con citas «verificadas» inventadas (`ISO 99999, numeral 99.9`) | Aceptado | Rechazado por la base de datos |
| Duplicar un hallazgo con citas inventadas | Aceptado | Rechazado |
| Citar un criterio real con un numeral que no le corresponde | Aceptado | Rechazado |
| Antedatar un hallazgo o una auditoría (`creado_en = 2020`) | Aceptado | El servidor fija la fecha real |
| Borrar físicamente hallazgos o una auditoría completa | Aceptado | Sin permiso: solo se descartan |
| Insertar un informe con contenido y modelo de IA falsos | Aceptado | Solo la Edge Function crea informes |

Que las citas fueran falsificables era especialmente grave: el informe lista los criterios «realmente
citados» como verificados.

**Corrección.**
- Trigger `validar_criterios_citados`: toda cita debe apuntar a un criterio que exista en
  `criterios_normativos`, con su numeral o un sub-numeral que aparezca literalmente en su texto; el documento
  y el título se toman de la base de datos.
- Marcas de tiempo fijadas por el servidor al crear e inmutables al editar.
- Sin `DELETE` para el cliente en ninguna tabla; los informes solo los escribe la Edge Function.
- **Historial de cambios** (`hallazgos_historial`): cada edición de un hallazgo guarda quién, cuándo, el antes
  y el después. El historial no se puede alterar.
- Una auditoría cerrada no admite hallazgos nuevos, también a nivel de base de datos.

**Verificación.** `pnpm probar:bd`, sección «Ataques a la integridad»: todos fallan para el atacante.

## S4 · Límite de uso de la IA evadible — Alta

**Problema.** La función contaba los usos del día y registraba el uso nuevo **al final** de la llamada a la
IA. Varias peticiones lanzadas a la vez veían el mismo conteo y todas pasaban: un solo usuario podía agotar
en segundos la cuota gratuita de todo el hospital. Tampoco había límite por minuto.

**Corrección.** La función `reservar_uso_ia` reserva el uso **antes** de llamar a la IA, con un bloqueo por
usuario en la base de datos (`pg_advisory_xact_lock`), y aplica un límite diario
(`LIMITE_IA_DIARIO_POR_USUARIO`) y uno por minuto (`LIMITE_IA_POR_MINUTO`, 5 por defecto). Solo la puede
llamar el servidor.

**Verificación.** `pnpm probar:bd`, sección «Normas, ia_eventos y cuota de IA».

## S5 · Sin CSP ni protección contra clickjacking — Media

**Problema.** La sesión de Supabase se guarda en `localStorage`. Sin Content Security Policy, una inyección
de HTML (por ejemplo, desde una dependencia comprometida) podría cargar código externo y enviar el token a
otro servidor. GitHub Pages no permite configurar cabeceras HTTP, y la app se podía mostrar dentro de un
iframe de otro sitio para engañar al usuario (*clickjacking*).

**Corrección.**
- CSP como `<meta>` generada en el build: solo scripts del propio sitio, conexiones solo al proyecto Supabase
  configurado, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. Se permite `'unsafe-inline'`
  únicamente para estilos (React y Recharts usan atributos `style`).
- `Referrer-Policy: strict-origin` (como `<meta>`).
- La app se niega a mostrarse dentro de un iframe (`frame-ancestors` no se puede declarar en un `<meta>`).

**Verificación.** `pnpm probar:interfaz` falla ante cualquier violación de la CSP, incluida la exportación a
PDF y Word, y comprueba el bloqueo en iframe.

**Incidente posterior (4/10/2026).** La variable `VITE_SUPABASE_URL` de GitHub quedó con un `\r\n` al final
(pegada desde el portapapeles). La primera versión de la CSP no reconoció el valor y publicó
`connect-src 'self'` sin el proyecto Supabase, lo que bloqueó el registro. Corrección: `vite.csp.js`
normaliza la URL, un valor inválido hace **fallar el build** en vez de publicar un sitio roto, y el CI
verifica que la CSP publicada incluya el origen de Supabase. La prueba de interfaz compila con ese mismo
valor sucio.

## S6 · Contraseñas débiles aceptadas por el servidor — Media

**Problema.** El formulario exigía 8 caracteres, pero Supabase Auth aceptaba 6 (su valor por defecto):
llamando la API directamente se creaban cuentas con contraseñas débiles.

**Corrección.** `supabase/config.toml`: mínimo 10 caracteres con mayúscula, minúscula y número, confirmación
de correo obligatoria, reautenticación para cambiar la contraseña y 60 s entre correos. El formulario aplica
la misma regla. **Hay que aplicar esta configuración al proyecto** (ver «Antes de producción»).

## S7 · Enumeración de cuentas — Media

**Problema.** Al registrarse con un correo existente, la app decía «Ese correo ya está registrado»: cualquiera
podía averiguar qué correos tienen cuenta.

**Corrección.** El visitante ve siempre el mismo mensaje («si el correo no tenía una cuenta, te enviamos un
enlace…»). Los errores de Supabase Auth se traducen a mensajes que no distinguen casos.

## S8 · Sin cierre por inactividad — Media

**Corrección.** La sesión se cierra tras **30 minutos sin actividad**, compartiendo la marca entre pestañas,
y el ingreso explica por qué se cerró.

## S9 · Sin autorización de tratamiento de datos (Ley 1581 de 2012) — Media

**Corrección.** El registro exige marcar la autorización, con un texto que explica responsable, finalidad,
envío a un proveedor de IA y derechos del titular. La base de datos rechaza un perfil sin autorización y
guarda la fecha (fijada por el servidor, no antedatable). El perfil la muestra.

**Pendiente.** El texto es una base técnica: **debe validarlo el área jurídica del hospital** y enlazar la
política oficial de tratamiento de datos.

## S10 · Mensajes de error internos — Media

**Corrección.** Los errores no previstos ya no se muestran tal cual (revelaban nombres de tablas,
restricciones y mensajes de Google): el usuario ve un mensaje genérico y el detalle queda en la consola o en
`ia_eventos`.

## S11 · Ajustes de menor riesgo — Baja

- **Topes de tamaño:** cuerpos de las funciones (32 KB), notas (2 000 caracteres), consultas de búsqueda
  recortadas en la base de datos (una de 1 MB ya no la bloquea), máximo 20 citas por hallazgo.
- **Mínimo privilegio:** el rol `anon` no tiene ningún permiso sobre las tablas ni las funciones; el cliente
  no tiene `TRUNCATE`, `REFERENCES` ni `TRIGGER`; ninguna función es ejecutable por `PUBLIC`.
- **Entradas validadas:** `completar-auditoria` solo acepta procesos y sistemas del catálogo; las fechas,
  en formato `AAAA-MM-DD`.
- **Redirección tras ingresar:** solo a rutas internas `/app/…`.
- **CI:** acciones de GitHub fijadas por SHA de commit (en sus versiones sobre Node 24), sin credenciales
  persistidas, y Dependabot semanal para dependencias y acciones.
- **Dependencias:** `pnpm audit` reporta una sola vulnerabilidad: `braces`, alta, sin parche publicado. Llega
  solo por las herramientas de compilación de Tailwind, no forma parte del bundle ni corre en producción.
  **Riesgo aceptado**; Dependabot avisará cuando haya parche.

---

## Ampliación: PDF de evidencia, riesgo, controles y matriz (4/10/2026)

Al ampliar el alcance (asistente de 7 pasos, riesgo del PR13_GQ, controles y matriz consolidada) se
diseñaron estos controles desde el inicio, con su prueba de regresión:

- **El PDF de evidencia no sale del navegador.** Se lee con pdf.js en el equipo del auditor; al servidor solo
  llega el texto que el auditor revisó (que pasa por `anonimizar()` como cualquier entrada, S1) y la huella
  `{nombre, paginas, sha256}`. No hay almacenamiento de archivos que proteger. La huella es inmutable y su
  formato lo valida un check de la base de datos. pdf.js se configura con `isEvalSupported: false`: la CSP no
  permite `eval` y no se relajó. *Pruebas:* `probar-bd` (huella inmutable y formato) y `probar-interfaz`
  (ninguna petición lleva el PDF; viaja solo la huella).
- **Controles íntegros.** El trigger `validar_controles` verifica que un control que cita un criterio apunte
  a uno real y que el auditor no haga pasar un control propio por uno de la IA. *Prueba:* `probar-bd`.
- **Validación honesta.** Editar un hallazgo validado lo devuelve a pendiente en el servidor (no depende del
  cliente), así la matriz descargada siempre corresponde a lo que se validó. *Prueba:* `probar-bd`.
- **El nivel de riesgo no lo decide la IA.** La IA propone probabilidad e impacto (validados de 1 a 5, V7);
  el nivel lo calcula el código con una escala fija que nadie edita (Bajo 1–4, Moderado 5–9, Alto 10–16,
  Extremo 17–25).
- **Cargos de lista cerrada.** Los cargos se validan en la base de datos contra las listas institucionales: no
  se pueden inyectar textos arbitrarios en las firmas del informe. *Prueba:* `probar-bd` (sección «Cargos y
  equipo auditor»).
- **Minimización de datos (Ley 1581).** La 0009 elimina las columnas del cargo escrito a mano y del acompañante
  único en vez de dejarlas como copia sin uso. La autorización de datos menciona ahora los nombres y cargos de
  las personas del equipo que registra el auditor.
- **El Excel se genera en el navegador** con los datos que el auditor ya puede leer por RLS: no hay un
  endpoint de exportación nuevo que proteger.

## Controles que se verificaron y estaban bien

- La API key de Gemini nunca llega al navegador: el CI busca los formatos `AIza…` y `AQ.…` en `dist/`, y la
  key no aparece en ningún commit del historial.
- Aislamiento entre usuarios con RLS, incluido el rol admin sin recursión.
- Un usuario no puede ascenderse a admin (corregido en la Fase 2 respecto del borrador del prompt maestro).
- La entrada original del auditor y la procedencia de la IA son inmutables.
- Las Edge Functions toman el usuario del JWT, nunca del cuerpo, y verifican la propiedad de la auditoría.
- CORS con orígenes explícitos, nunca `*`.
- Las citas que devuelve la IA se verifican en el servidor (V1–V6) antes de guardarse.
- No hay HTML crudo en React (`dangerouslySetInnerHTML`): el resaltado del explorador de normas se arma con
  elementos.

## Antes de producción

Ordenadas por importancia. Ninguna se puede hacer desde el código.

1. **Activar la facturación de Google AI Studio** (nivel pago) antes de capturar hallazgos reales. Es la
   única manera de que Google no use ni revise los textos (S1). Con el nivel pago se puede además desactivar
   la cascada de modelos.
2. **Rotar la API key de Gemini**: la actual circuló fuera de un gestor de secretos durante el desarrollo.
3. **Aplicar la configuración de Auth** al proyecto: `supabase config push`, o en el dashboard
   (Authentication → Policies/Providers): contraseña mínima de 10 con mayúscula, minúscula y número;
   confirmación de correo; *Secure password change* (S6).
4. **Nombrar al primer administrador** tras registrarte (SQL Editor):
   ```sql
   update public.profiles set rol = 'admin', aprobado = true where cedula = '<tu cédula>';
   ```
5. **Validación jurídica:** texto de autorización de datos (S9), política de tratamiento de datos del
   hospital y, si aplica, registro de la base de datos ante la SIC. La región del proyecto Supabase y el uso
   de Google implican **transferencia internacional de datos**: debe quedar cubierta en la política.
6. **Autenticación de dos factores para administradores:** Supabase permite TOTP; la interfaz aún no lo
   implementa. Recomendado como siguiente mejora.
7. **Respaldos:** revisa la política de respaldos de tu plan de Supabase. Para información institucional
   conviene un plan con respaldos diarios o recuperación a un punto en el tiempo.
8. Después de desplegar, ejecutar `pnpm verificar-rls` contra el proyecto real (incluye los ataques de S2 y S3).

## Cómo repetir la auditoría

```bash
pnpm probar            # sin red: 76 de validación (V1–V7), anonimización y catálogos, 14 de cascada,
                       # 96 de base de datos (RLS, aprobación, ataques de integridad, cuota, riesgo,
                       # controles, cargos y equipo auditor) y 8 de búsqueda
pnpm probar:interfaz   # 121 de extremo a extremo, incluidas CSP, PDF, matriz, cargos, cuentas pendientes, admin e iframe
pnpm verificar-rls     # contra el proyecto Supabase real
pnpm audit             # vulnerabilidades conocidas en dependencias
```
