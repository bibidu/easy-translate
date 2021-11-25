import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import babel from "@rollup/plugin-babel";
import progress from "rollup-plugin-progress";
import { terser } from "rollup-plugin-terser";
import postcss from "rollup-plugin-postcss";
import copy from "rollup-plugin-copy";
import alias from "@rollup/plugin-alias";
import replace from "@rollup/plugin-replace";

const production = process.env.NODE_ENV === "production";
export default {
  extensions: [".ts", ".js", ".tsx"],
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
    replace({
      preventAssignment: true,
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    }),
    alias({
      entries: [{ find: "@", replacement: "./src" }],
    }),
    postcss({
      extensions: [".css"],
    }),
    nodeResolve({
      preferBuiltins: false,
    }),
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
