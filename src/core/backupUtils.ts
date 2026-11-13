/**
 * backupUtils.ts - Utilidades para descargar copias de seguridad JSON completas de Dexie.
 */

import { exportDatabaseJSON } from '../db/database';

/**
 * Exporta toda la base de datos local como JSON y dispara la descarga en el navegador.
 * Retorna la cadena JSON generada y el nombre de archivo utilizado.
 */
export async function downloadDatabaseJSONBackup(): Promise<{ filename: string; json: string }> {
  const json = await exportDatabaseJSON();
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `Cotizador-IEBA-Backup-${dateStamp}.json`;

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }

  return { filename, json };
}
