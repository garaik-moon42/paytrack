import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const source = resolve("appsscript.json");
const target = resolve("build", "appsscript.json");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);

copyHtmlFiles(resolve("src"), resolve("build"));

function copyHtmlFiles(sourceDir, targetDir) {
  for (const entry of readdirSync(sourceDir)) {
    const sourcePath = join(sourceDir, entry);
    const stats = statSync(sourcePath);

    if (stats.isDirectory()) {
      copyHtmlFiles(sourcePath, join(targetDir, entry));
      continue;
    }

    if (extname(sourcePath) !== ".html") {
      continue;
    }

    const targetPath = join(targetDir, relative(resolve("src"), sourcePath));
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}
