import { describe, it, expect } from 'vitest';
import { generateUUID, ensureCryptoRandomUUIDPolyfill } from './uuid';

describe('UUID Resiliente (Secure & Non-Secure Contexts)', () => {
  it('genera un UUID v4 con formato válido xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx', () => {
    const id = generateUUID();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('genera identificadores únicos en llamadas consecutivas', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateUUID());
    }
    expect(ids.size).toBe(100);
  });

  it('produce formato válido usando fallback cuando crypto.randomUUID no está disponible', () => {
    const original = crypto.randomUUID;
    try {
      // @ts-expect-error simular que randomUUID no es función
      crypto.randomUUID = undefined;
      const id = generateUUID();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    } finally {
      crypto.randomUUID = original;
    }
  });

  it('produce formato válido cuando getRandomValues y randomUUID están ausentes', () => {
    const origUUID = crypto.randomUUID;
    const origRand = crypto.getRandomValues;
    try {
      // @ts-expect-error simular entorno sin WebCrypto
      crypto.randomUUID = undefined;
      // @ts-expect-error simular entorno sin getRandomValues
      crypto.getRandomValues = undefined;
      const id = generateUUID();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    } finally {
      crypto.randomUUID = origUUID;
      crypto.getRandomValues = origRand;
    }
  });

  it('ensureCryptoRandomUUIDPolyfill asegura que crypto.randomUUID esté siempre definido', () => {
    ensureCryptoRandomUUIDPolyfill();
    expect(typeof crypto.randomUUID).toBe('function');
    const id = crypto.randomUUID();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
