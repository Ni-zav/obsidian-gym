import esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const context = await esbuild.context({
  entryPoints: ["plugin-src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*"],
  format: "cjs",
  target: "es2022",
  outfile: ".obsidian/plugins/obsidian-gym/main.js",
  logLevel: "info",
  sourcemap: false,
  treeShaking: true,
});

if (watch) await context.watch();
else {
  await context.rebuild();
  await context.dispose();
}
