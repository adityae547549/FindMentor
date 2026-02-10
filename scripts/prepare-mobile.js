import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.join(rootDir, 'www');

// Create www directory
if (!fs.existsSync(wwwDir)) {
    fs.mkdirSync(wwwDir);
}

// Function to copy file
function copyFile(src, dest) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${src} to ${dest}`);
}

// Function to copy directory recursively
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            copyFile(srcPath, destPath);
        }
    }
}

// Copy index.html and styles.css
const filesToCopy = ['index.html', 'styles.css'];
filesToCopy.forEach(file => {
    const srcPath = path.join(rootDir, file);
    if (fs.existsSync(srcPath)) {
        copyFile(srcPath, path.join(wwwDir, file));
    } else {
        console.warn(`Warning: ${file} not found in root directory.`);
    }
});

// Copy frontend directory
const frontendSrc = path.join(rootDir, 'frontend');
const frontendDest = path.join(wwwDir, 'frontend');
if (fs.existsSync(frontendSrc)) {
    copyDir(frontendSrc, frontendDest);
    console.log('Copied frontend directory to www/frontend');
} else {
    console.error('Error: frontend directory not found!');
}

console.log('Mobile build preparation complete.');
