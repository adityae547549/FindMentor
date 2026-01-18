import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ================================
   WINDOWS-SAFE __dirname
================================ */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let DATASET = [];

/* ================================
   LOAD DATA
================================ */

export function loadData() {
  const dataDir = path.join(__dirname, "data");

  if (!fs.existsSync(dataDir)) {
    console.error("❌ DATA FOLDER NOT FOUND:", dataDir);
    process.exit(1);
  }

  const classFolders = fs.readdirSync(dataDir);

  for (const folder of classFolders) {
    const folderPath = path.join(dataDir, folder);

    if (!fs.statSync(folderPath).isDirectory()) continue;

    const files = fs.readdirSync(folderPath);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const fullPath = path.join(folderPath, file);

      try {
        const raw = fs.readFileSync(fullPath, "utf8");
        const parsed = JSON.parse(raw);
        DATASET.push(parsed);
      } catch (err) {
        console.log("❌ Broken JSON:", fullPath);
      }
    }
  }

  console.log(`📚 Dataset loaded: ${DATASET.length}`);
  
  // Set on global for server.js access
  global.DATASET = DATASET;
}

// Export DATASET for direct access if needed
export function getDataset() {
  return DATASET;
}

/* ================================
   DEEP SEARCH ENGINE
================================ */

function deepSearch(obj, query) {
  const results = [];

  function walk(node) {
    if (typeof node === "string") {
      if (node.toLowerCase().includes(query)) {
        results.push(node);
      }
    }

    if (typeof node === "object" && node !== null) {
      for (const key in node) {
        walk(node[key]);
      }
    }
  }

  walk(obj);
  return results;
}

/* ================================
   SEARCH API
================================ */

export function searchData(question) {
  const q = question.toLowerCase();

  for (const item of DATASET) {
    const matches = deepSearch(item, q);

    if (matches.length > 0) {
      return {
        found: true,
        class: item.class,
        subject: item.subject,
        chapter:
          item.chapter_name ||
          item.chapter ||
          "Multiple sections",
        answer: matches[0]
      };
    }
  }

  return { found: false };
}
