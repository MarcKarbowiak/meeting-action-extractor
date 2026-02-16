import { LocalJsonStore, getDefaultDataDir } from '@meeting-action-extractor/db';

let storeSingleton: LocalJsonStore | undefined;

const getDataDir = (): string => {
  const configured = process.env.LOCAL_DATA_DIR;
  if (configured && configured.trim().length > 0) {
    return configured;
  }

  return getDefaultDataDir();
};

export const getStore = (): LocalJsonStore => {
  if (!storeSingleton) {
    storeSingleton = new LocalJsonStore(getDataDir());
    storeSingleton.initialize();
  }

  return storeSingleton;
};

export const resetStoreSingleton = (): void => {
  storeSingleton = undefined;
};
