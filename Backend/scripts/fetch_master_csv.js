// scripts/fetch_master.js
import fs from "fs";
import https from "https";
import path from "path";

const url  = "https://images.dhan.co/api-data/api-scrip-master-detailed.csv";
const dest = "data/master-detailed.csv";

fs.mkdirSync(path.dirname(dest), { recursive: true });

function download(u, outFile) {
    return new Promise((resolve, reject) => {
        https.get(u, (res) => {
            // handle redirect
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(download(res.headers.location, outFile));
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            const file = fs.createWriteStream(outFile);
            res.pipe(file);
            file.on("finish", () => file.close(() => resolve(outFile)));
            file.on("error", (e) => reject(e));
        }).on("error", reject);
    });
}

try {
    const out = await download(url, dest);
    console.log("✅ CSV saved:", out);
} catch (e) {
    console.error("❌ Download error:", e.message || e);
    process.exit(1);
}
