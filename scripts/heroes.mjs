import sharp from "sharp";
import fs from "fs";
const STYLE = "soft cream studio background, 3d render, minimal cute style, green leaf accents, high quality product render, no text, no watermark, no people";
const items = [
  ["hero-planner.jpg", "open spiral notebook planner standing upright, weekly grid of tiny healthy meal photos inside cells, green protein shaker bottle beside it, eucalyptus leaves around"],
  ["hero-store.jpg", "two standing cookbook books on white round podiums, one cover shows healthy food bowl, smartphone showing green shopping list app, small black dumbbell, eucalyptus leaves"],
  ["hero-pro.jpg", "shiny golden royal crown floating above a green glowing round podium platform, small floating rounded app icon tiles around it, eucalyptus leaves"]
];
for (const [file, p] of items) {
  if (fs.existsSync("img/" + file)) { console.log("exists", file); continue; }
  try {
    const r = await fetch("https://image.pollinations.ai/prompt/" + encodeURIComponent(p + ". " + STYLE) + "?width=1200&height=900&nologo=true");
    if (!r.ok) { console.log("skip", file, r.status); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    await sharp(buf).resize(1200, 900, { fit: "cover" }).jpeg({ quality: 75 }).toFile("img/" + file);
    console.log("ok", file);
  } catch (e) { console.log("err", file); }
}
console.log("heroes done");
