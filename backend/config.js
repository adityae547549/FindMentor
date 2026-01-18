import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ FORCE LOAD .env from backend directory
const envPath = path.join(__dirname, ".env");
dotenv.config({ path: envPath });

export const CONFIG = {
  PORT: process.env.PORT || 3000,
  GROQ_API_KEY: process.env.GROQ_API_KEY
};

if (!CONFIG.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY is missing in backend/.env");
  console.error("📁 Expected path:", envPath);
  process.exit(1);
}
