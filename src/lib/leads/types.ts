/** Tipos compartidos del flujo de leads (Fase 2). Sin dependencias de Astro. */

/** Fila de `public.leads` (ver supabase/migrations/0001_leads.sql). */
export interface LeadRow {
  submission_id: string;
  created_at?: string;
  landing_id: string;
  tratamiento: string;
  localidad: string | null;
  nombre: string;
  telefono: string;
  email: string | null;
  ciudad: string;
  interes: string | null;
  privacy_notice_version: string;
  privacy_acknowledged_at: string;
  page_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  gclid: string | null;
  fbclid: string | null;
  notification_status: 'pending' | 'sent' | 'failed';
  notification_attempts: number;
  notification_claimed_at: string | null;
}

/** Datos de la landing resueltos desde el contenido del repositorio (nunca del cliente). */
export interface TrustedLanding {
  landingId: string;
  tratamiento: string;
  tratamientoNombre: string;
  localidad?: string;
  localidadNombre?: string;
  /** valor → etiqueta de las opciones de interés del tratamiento. */
  interesOpciones: Record<string, string>;
  /** Texto de la casilla de privacidad mostrado al usuario. */
  textoPrivacidad: string;
}

/** Contenido mínimo de la notificación por email. */
export interface LeadNotification {
  submissionId: string;
  createdAt: string;
  nombre: string;
  telefono: string;
  email?: string;
  ciudad: string;
  interes?: string;
  landing: string;
}

export type NotifyResult = { ok: true } | { ok: false; error: string };

export interface LeadStore {
  /** Inserta el lead. `duplicate` si ya existía ese submission_id. Lanza si falla. */
  insertLead(row: LeadRow): Promise<'created' | 'duplicate'>;
  /** Registra el resultado del envío y libera la reclamación. */
  finishNotification(submissionId: string, result: NotifyResult): Promise<void>;
  /** Reclama atómicamente leads con notificación pendiente o fallida. */
  claimRetryable(maxRows: number): Promise<LeadRow[]>;
}
