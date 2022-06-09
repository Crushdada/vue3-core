const { resolve } = require("path"); // node内置模块
const args = require("minimist")(process.argv.slice(2));
// minimist 是一个用于解析命令行参数的包
const { build } = require("esbuild"); // vue采用的开发环境下打包工具，巨快无比

// 指定要打包哪个模块，如果命令中没给，就在这里指定默认打包reactivity模块
const target = args._[0] || "reactivity";
const format = args.f || "global";

// 解析路径，去加载要打包的模块的package.json配置文件
const pkg = require(resolve(__dirname, `../packages/${target}/package.json`));
console.log(Object.prototype.toString.call(format));
// str.startWith() 判断字符串是否以参数开头
// global格式，立即执行函数 (function (){})()
// commonJS格式， node中的模块 module.exports
// esm 浏览器中的esModule模块 import
const outputFormat = format.startsWith("global")
  ? "iife"
  : format.startsWith("cjs")
  ? "cjs"
  : "esm";

const outFile = resolve(
  __dirname,
  `../packages/${target}/dist/${target}.${format}.js`
);

build({
  entryPoints: [resolve(__dirname, `../packages/${target}/src/index.ts`)],
  sourcemap: true,
  format: outputFormat,
  globalName: pkg.buildOptions.name, // 打包的全局的名字
  bundle: true, // 把所有包打包到一起
  outfile: outFile,
  platform: outputFormat === "cjs" ? "node" : "browser",
  // 启动轮询的监听模式
  watch: {
    onRebuild(error, result) {
      if (error) console.error("watch build failed:", error);
      else {
        // 这里来自动打开浏览器并且更新浏览器
        console.log("\x1B[36m%s\x1B[39m", "watch build succeeded");
      }
    },
  },
}).then(() => {
  console.log("watching:)");
});
