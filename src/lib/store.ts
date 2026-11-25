import fs from "fs";
import path from "path";
import { KnowShanStore } from "@/types/knowshan";
import { createInitialStore } from "@/lib/seed";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

export function readStore(): KnowShanStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const initial = createInitialStore();
      fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw) as KnowShanStore;
  } catch {
    return createInitialStore();
  }
}

export function writeStore(store: KnowShanStore): KnowShanStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch {
    // Graceful fallback in read-only serverless environments
  }
  return store;
}

export function resetStoreToStoryline(): KnowShanStore {
  const fresh = createInitialStore();
  return writeStore(fresh);
}
