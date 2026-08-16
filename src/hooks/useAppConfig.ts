import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { AppConfig } from '../core/types';
import { DEFAULT_APP_CONFIG, BASE_TAREA_CATEGORIES } from '../core/sampleData';

/**
 * Hook reactivo para acceder y gestionar la configuración global de la aplicación (db.config).
 */
export function useAppConfig() {
  const configs = useLiveQuery(() => db.config.toArray());
  const isLoading = configs === undefined;
  
  const rawConfig = configs && configs.length > 0 ? configs[0] : DEFAULT_APP_CONFIG;

  const config: AppConfig = {
    ...DEFAULT_APP_CONFIG,
    ...rawConfig,
    categoriasTarea: (rawConfig.categoriasTarea && rawConfig.categoriasTarea.length > 0)
      ? rawConfig.categoriasTarea
      : BASE_TAREA_CATEGORIES
  };

  const updateConfig = async (updatedFields: Partial<AppConfig>) => {
    const existing = await db.config.toArray();
    if (existing.length > 0) {
      await db.config.update(existing[0].id, {
        ...updatedFields,
        updatedAt: new Date().toISOString()
      });
    } else {
      await db.config.add({
        ...DEFAULT_APP_CONFIG,
        ...updatedFields,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  };

  const saveFullConfig = async (newConfig: AppConfig) => {
    await db.config.put({
      ...newConfig,
      updatedAt: new Date().toISOString()
    });
  };

  const restoreDefaults = async () => {
    const existing = await db.config.toArray();
    if (existing.length > 0) {
      await db.config.put({
        ...DEFAULT_APP_CONFIG,
        id: existing[0].id,
        updatedAt: new Date().toISOString()
      });
    } else {
      await db.config.add(DEFAULT_APP_CONFIG);
    }
  };

  return {
    config,
    isLoading,
    updateConfig,
    saveFullConfig,
    restoreDefaults,
    categoriasTarea: config.categoriasTarea || BASE_TAREA_CATEGORIES
  };
}
