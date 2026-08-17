import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF6F0", // 米白底色
        card: "#F5EFE5", // 卡片暖灰
        line: "#E7DECE", // 分隔线/描边
        ink: "#2B2520", // 正文墨色
        sub: "#8A7E6E", // 次要文字
        accent: "#A4472B", // 强调（陶土红）
        accentSoft: "#F1E1D5", // 选中态浅底
      },
      fontFamily: {
        // 故事正文：系统中文字体衬线栈，避免构建期联网下载字体
        serif: [
          '"Songti SC"',
          '"Noto Serif CJK SC"',
          '"Source Han Serif SC"',
          "SimSun",
          '"Times New Roman"',
          "serif",
        ],
        // UI 界面：无衬线栈
        sans: [
          "-apple-system",
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
