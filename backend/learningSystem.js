import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use system temp directory to avoid triggering reloads in dev environment
const DATA_DIR = path.join(os.tmpdir(), 'findmentor_data');
const YOUTUBE_CACHE_FILE = path.join(DATA_DIR, 'cache_youtube.json');
const QA_CACHE_FILE = path.join(DATA_DIR, 'learned_qa.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to read JSON safely
function readJSON(filePath) {
    try {
        if (!fs.existsSync(filePath)) return {};
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        return {};
    }
}

// Helper to write JSON safely
function writeJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error.message);
    }
}

// --- YouTube Caching ---

export function getYouTubeCache(videoId, question) {
    const cache = readJSON(YOUTUBE_CACHE_FILE);
    const key = `${videoId}_${question || 'summary'}`;
    return cache[key] || null;
}

export function saveYouTubeCache(videoId, question, data) {
    const cache = readJSON(YOUTUBE_CACHE_FILE);
    const key = `${videoId}_${question || 'summary'}`;
    cache[key] = {
        ...data,
        cachedAt: Date.now()
    };
    writeJSON(YOUTUBE_CACHE_FILE, cache);
    console.log(`💾 Saved YouTube summary to cache: ${key}`);
}

// --- General Q&A Learning ---

export function findLearnedAnswer(question) {
    const cache = readJSON(QA_CACHE_FILE);
    // Simple exact match or fuzzy match could be implemented here
    // For now, we use exact match of the normalized question
    const normalizedQ = question.toLowerCase().trim();
    
    // Search for existing questions
    for (const key in cache) {
        if (key.toLowerCase().trim() === normalizedQ) {
            return cache[key];
        }
    }
    return null;
}

export function learnAnswer(question, answer, source = 'ai') {
    const cache = readJSON(QA_CACHE_FILE);
    const normalizedQ = question.toLowerCase().trim();
    
    // Don't overwrite if exists (unless we add a versioning system later)
    if (cache[normalizedQ]) return;

    cache[normalizedQ] = {
        question: question,
        answer: answer,
        source: source,
        learnedAt: Date.now()
    };
    writeJSON(QA_CACHE_FILE, cache);
    console.log(`🧠 Learned new Q&A: "${question.substring(0, 30)}..."`);
}
