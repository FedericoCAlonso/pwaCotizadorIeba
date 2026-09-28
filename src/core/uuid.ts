/**
 * @fileoverview Generador de UUIDs v4 compatible con RFC-4122.
 * Funciona de manera resiliente tanto en contextos seguros (HTTPS, localhost)
 * como en redes locales (HTTP en IPs como 10.x.x.x o 192.168.x.x) donde los navegadores
 * restringen el acceso nativo a `crypto.randomUUID`.
 */

export function generateUUID(): string {
  // 1. Intento nativo de crypto.randomUUID (disponible en Secure Contexts)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Continuar al fallback
    }
  }

  // 2. Fallback criptográfico con crypto.getRandomValues (suele estar disponible aun en HTTP)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Versión 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variante RFC 4122
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch {
      // Continuar al fallback aleatorio
    }
  }

  // 3. Fallback determinista basado en timestamp + performance + Math.random
  let d = Date.now();
  let d2 = (typeof performance !== 'undefined' && performance.now && Math.floor(performance.now() * 1000)) || 0;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    let r = Math.floor(Math.random() * 16);
    if (d > 0) {
      r = (d + r) % 16;
      d = Math.floor(d / 16);
    } else if (d2 > 0) {
      r = (d2 + r) % 16;
      d2 = Math.floor(d2 / 16);
    }
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Polyfill global no invasivo para window.crypto.randomUUID.
 * Asegura que cualquier llamada directa a crypto.randomUUID() en librerías
 * o componentes existentes no lance error en contextos no seguros (LAN / HTTP).
 */
export function ensureCryptoRandomUUIDPolyfill(): void {
  const target = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  if (!target) return;

  if (!target.crypto) {
    // @ts-expect-error polyfill
    target.crypto = {};
  }

  if (typeof target.crypto.randomUUID !== 'function') {
    try {
      Object.defineProperty(target.crypto, 'randomUUID', {
        value: generateUUID,
        writable: true,
        configurable: true
      });
    } catch {
      // @ts-expect-error fallback de asignación directa
      target.crypto.randomUUID = generateUUID;
    }
  }
}

// Ejecutar inmediatamente al importar el módulo
ensureCryptoRandomUUIDPolyfill();
