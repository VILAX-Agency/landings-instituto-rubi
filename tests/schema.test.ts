import { describe, expect, it } from 'vitest';
import { erroresPorCampo, leadInputSchema, normalizarTelefono } from '../src/lib/leads/schema';
import { validInput } from './fixtures';

describe('normalizarTelefono', () => {
  it.each([
    ['600 000 000', '+34600000000'],
    ['600-00-00-00', '+34600000000'],
    ['+34 600 000 000', '+34600000000'],
    ['0034600000000', '+34600000000'],
    ['+44 20 7946 0958', '+442079460958'],
    ['(93) 677 64 51', '+34936776451'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizarTelefono(raw)).toBe(expected);
  });

  it.each(['', '12', 'abc', '+34 600 000 000 000 000', '600 000 000 ext 2'])('rechaza %j', (raw) => {
    expect(normalizarTelefono(raw)).toBeUndefined();
  });
});

describe('leadInputSchema', () => {
  it('acepta un envío válido y normaliza email y teléfono', () => {
    const r = leadInputSchema.parse(validInput());
    expect(r.telefono).toBe('+34600000000');
    expect(r.email).toBe('ana@example.com');
    expect(r.consentimiento).toBe(true);
  });

  it('email vacío = ausente', () => {
    expect(leadInputSchema.parse(validInput({ email: '  ' })).email).toBeUndefined();
  });

  it('campos obligatorios ausentes devuelven errores por campo', () => {
    const r = leadInputSchema.safeParse(
      validInput({ nombre: '', telefono: '', ciudad: '', consentimiento: false, email: 'no-es-email' }),
    );
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(erroresPorCampo(r.error)).toEqual({
      nombre: 'Indica tu nombre.',
      telefono: 'Indica tu teléfono.',
      email: 'Revisa el email.',
      ciudad: 'Elige tu ciudad.',
      consentimiento: 'Debes aceptar la política de privacidad.',
    });
  });

  it('rechaza ciudades fuera de la lista', () => {
    expect(leadInputSchema.safeParse(validInput({ ciudad: 'paris' })).success).toBe(false);
  });

  it('rechaza submission_id no UUID', () => {
    expect(leadInputSchema.safeParse(validInput({ submission_id: '123' })).success).toBe(false);
  });

  it('limita longitudes', () => {
    expect(leadInputSchema.safeParse(validInput({ nombre: 'a'.repeat(121) })).success).toBe(false);
    expect(leadInputSchema.safeParse(validInput({ utm_source: 'a'.repeat(201) })).success).toBe(false);
    expect(leadInputSchema.safeParse(validInput({ page_url: 'a'.repeat(2001) })).success).toBe(false);
  });

  it('consentimiento debe ser exactamente true', () => {
    expect(leadInputSchema.safeParse(validInput({ consentimiento: 'on' })).success).toBe(false);
  });
});
