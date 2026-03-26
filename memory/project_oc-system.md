---
name: oc-system proyecto
description: Contexto técnico del proyecto Memphis ERP - Sistema de Compras
type: project
---

Sistema ERP de compras llamado "Memphis" para empresa peruana.

**Stack:** React 19 + Vite + Tailwind + Firebase (Firestore, Auth, Storage, FCM)

**Colecciones Firestore principales:**
- `ordenesCompra` — OC/OS/OI, con correlativo `MM-XXXXXX`
- `requerimientos` — RQ-XXXXX, correlativo en `correlativos/requerimientos`
- `cotizaciones` — ligadas a requerimientos
- `usuarios/{email}` — rol, estado
- `tokensFCM/{email}` — tokens push
- `notificaciones` — fallback in-app
- `cajaChica` — movimientos tipo ingreso/egreso
- `logs` — auditoría
- `firmas/{email}` — firma digital
- `centrosCosto`, `condicionesPago` — maestros

**Roles:** admin, soporte, comprador, operaciones, gerencia operaciones, gerencia general, gerencia, finanzas, gerencia finanzas, administracion, legal

**Flujo de aprobación de OC por monto:**
- Siempre pasa por: Pendiente de Operaciones
- > 10,000 → también Pendiente de Gerencia Operaciones
- >= 50,000 → también Pendiente de Gerencia General
- Los umbrales están en `src/utils/aprobaciones.js` → `APPROVAL_THRESHOLDS`

**Why:** Sistema interno de empresa, en producción activa.
**How to apply:** Respetar el flujo de estados y umbrales. No cambiar estados directamente sin pasar por `aprobarOC`/`rechazarOC`.
