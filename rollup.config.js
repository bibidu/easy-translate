import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import babel from "@rollup/plugin-babel";
import progress from "rollup-plugin-progress";
import { terser } from "rollup-plugin-terser";
import postcss from "rollup-plugin-postcss";
import copy from "rollup-plugin-copy";

const production = process.env.NODE_ENV === "production";
export default {
  input: "src/contentScript.tsx",
  output: [
    {
      file: "dist/contentScript.js",
      format: "umd",
      exports: "named",
    },
  ],
  plugins: [
    copy({
      targets: [
        { src: "src/popup.html", dest: "dist/" },
        { src: "src/manifest.json", dest: "dist/" },
        { src: "src/icon.png", dest: "dist/" },
      ],
    }),
    postcss({
      extensions: [".css"],
    }),
    nodeResolve(),
    commonjs(),
    babel({
      extensions: [".js", ".jsx", ".es6", ".es", ".mjs", ".ts", ".tsx"],
      babelHelpers: "bundled",
      presets: ["solid", "@babel/preset-typescript"],
    }),
    production && terser({ format: { comments: false } }),
    progress(),
  ],
};
