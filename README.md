# App de turnos — Dra. Natalia Hebe Volpe

Sistema de gestión de turnos médicos con panel de administración para la doctora y portal de autogestión para pacientes.

---

## Instrucciones de instalación paso a paso

### 1. Crear el proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) e iniciar sesión (o crear cuenta gratuita)
2. Hacer clic en **"New project"**
3. Elegir nombre del proyecto (ej: `natalia-volpe`) y una contraseña segura
4. Esperar que el proyecto termine de crearse (~2 minutos)

### 2. Ejecutar el schema SQL

1. En el panel de Supabase, ir a **SQL Editor** (ícono de terminal en la barra lateral)
2. Hacer clic en **"New query"**
3. Copiar el contenido completo del archivo `schema.sql` que está en este proyecto
4. Pegar en el editor y hacer clic en **"Run"**
5. Verificar que no haya errores y que las tablas aparezcan en **Table Editor**

### 3. Crear el usuario de la doctora

1. En Supabase, ir a **Authentication → Users**
2. Hacer clic en **"Invite user"** o **"Add user"**
3. Ingresar el email de la doctora y una contraseña segura
4. Guardar el email y contraseña en un lugar seguro

### 4. Configurar variables de entorno

1. En Supabase, ir a **Settings → API**
2. Copiar:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Esta clave es secreta, nunca exponerla públicamente
3. Copiar el archivo de ejemplo y completarlo:
   ```bash
   cp .env.local.example .env.local
   ```
4. Editar `.env.local` con los valores reales:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
   SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
   RECORDATORIOS_API_KEY=una_clave_secreta_larga_y_aleatoria
   NEXT_PUBLIC_NOMBRE_DOCTORA="Dra. Natalia Hebe Volpe"
   NEXT_PUBLIC_WHATSAPP_CONTACTO="549XXXXXXXXXX"
   ```
   Para `NEXT_PUBLIC_WHATSAPP_CONTACTO`, usar el formato: `549` + código de área + número (sin el 15). Ej: `5491154321234`

### 5. Levantar el proyecto en local

```bash
# Instalar dependencias (si no lo hiciste ya)
npm install

# Levantar el servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) para ver el portal del paciente.
El panel de la doctora está en [http://localhost:3000/admin](http://localhost:3000/admin).

### 6. Deploy en Vercel

1. Crear cuenta en [vercel.com](https://vercel.com) si no tenés
2. Instalar Vercel CLI o usar la interfaz web
3. Conectar el repositorio de GitHub con el proyecto (recomendado) o hacer deploy directo:
   ```bash
   npx vercel
   ```
4. En el panel de Vercel, ir a **Settings → Environment Variables**
5. Agregar todas las variables de entorno del `.env.local` (sin el punto inicial)
6. Hacer redeploy para que tome las variables

**Opción más fácil:** Ir a [vercel.com/new](https://vercel.com/new), seleccionar el repositorio de GitHub, y completar las variables de entorno antes de hacer deploy.

---

## Conectar Make.com para recordatorios automáticos de WhatsApp

### Descripción del flujo

Make.com llama al API cada hora, obtiene los recordatorios pendientes, envía el mensaje por WhatsApp (usando una integración de WhatsApp Business o UltraMsg/Twilio), y marca cada recordatorio como enviado.

### Paso a paso en Make.com

1. Crear cuenta en [make.com](https://make.com)
2. Crear un nuevo **Scenario**
3. Configurar el **trigger**: módulo **Schedule** → cada 1 hora

4. Agregar módulo **HTTP → Make a request**:
   - URL: `https://TU-APP.vercel.app/api/recordatorios/pendientes`
   - Method: `GET`
   - Headers: `x-api-key: TU_RECORDATORIOS_API_KEY`

5. Agregar módulo **Iterator** para recorrer el array `recordatorios`

6. Para cada recordatorio, agregar módulo de **WhatsApp** (UltraMsg, Twilio o Meta Business):
   - Número destino: campo `telefono` (formato `54911...`)
   - Mensaje: personalizado con los campos `nombre`, `fecha`, `hora`, `modalidad`, `tipo_recordatorio`

   Ejemplo de mensaje para recordatorio de 24h:
   ```
   Hola {{nombre}}! Te recuerdo que mañana tenés turno con la Dra. Natalia Volpe a las {{hora}} hs ({{modalidad}}). ¡Hasta mañana!
   ```

7. Agregar módulo **HTTP → Make a request** para marcar como enviado:
   - URL: `https://TU-APP.vercel.app/api/recordatorios/{{turno_id}}/enviado`
   - Method: `PATCH`
   - Headers: `x-api-key: TU_RECORDATORIOS_API_KEY`
   - Body JSON: `{"tipo": "{{tipo_recordatorio}}"}`

8. Activar el scenario

### Respuesta del API

```json
{
  "recordatorios": [
    {
      "turno_id": "uuid-del-turno",
      "tipo_recordatorio": "24h",
      "nombre": "María",
      "apellido": "García",
      "telefono": "1154321234",
      "fecha": "2024-12-20",
      "hora": "10:00:00",
      "modalidad": "videollamada"
    }
  ],
  "total": 1
}
```

---

## Estructura del proyecto

```
/app
  /                     → Portal del paciente (página inicio)
  /sacar-turno          → Flujo de 4 pasos para reservar turno
  /admin
    /login              → Login de la doctora
    /                   → Dashboard con turnos del día
    /turnos             → Calendario y gestión de turnos
    /pacientes          → Lista y ficha de cada paciente
    /pagos              → Registro y seguimiento de pagos
    /configuracion      → Configuración del sistema
    /recordatorios      → Panel de recordatorios pendientes
  /api
    /recordatorios/pendientes    → GET: lista recordatorios para Make.com
    /recordatorios/[id]/enviado  → PATCH: marcar recordatorio como enviado

/components
  /ui                   → Componentes reutilizables (Button, Card, Modal, etc.)
  /admin                → Componentes específicos del panel admin

/lib
  supabase.ts           → Cliente Supabase para el navegador
  supabase-server.ts    → Cliente Supabase para el servidor (service role)
  types.ts              → Tipos TypeScript de toda la app
  utils.ts              → Funciones de utilidad

schema.sql              → Schema completo de la base de datos
```

---

## Preguntas frecuentes

**¿Puedo cambiar el horario de atención?**
Sí, desde el panel `/admin/configuracion` podés modificar los días de atención, el horario de inicio y fin, la duración de cada turno, y agregar feriados.

**¿Qué pasa si un paciente ya existe?**
El portal del paciente busca por número de teléfono. Si ya existe un paciente con ese teléfono, usa el mismo registro en lugar de crear uno duplicado.

**¿Cómo cambio la contraseña de acceso al panel?**
Desde el panel de Supabase, en Authentication → Users, podés cambiar la contraseña del usuario.

**¿Los comprobantes de pago están seguros?**
Sí. Se guardan en Supabase Storage con acceso restringido (solo usuarios autenticados pueden verlos).
