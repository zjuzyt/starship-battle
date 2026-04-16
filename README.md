# Starship Battle / 星际战舰小游戏

一个零依赖的浏览器 Canvas 小游戏。无需安装依赖，克隆后即可运行。

仓库地址：

```text
https://github.com/zjuzyt/starship-battle
```

## 在线试玩

启用 GitHub Pages 后，在线地址为：

```text
https://zjuzyt.github.io/starship-battle/
```

如果暂时无法访问，通常是 Pages 还在首次部署中（一般 1-3 分钟）。

## 游戏操作

- `WASD` 或方向键：移动战舰
- `空格`：发射
- `P`：暂停/继续
- 触屏设备：使用页面底部方向键和发射按钮

## 游戏目标

击毁敌舰和陨石获得分数，拾取蓝色补给可短时间进入三连发。生命归零后可重新开始。

## 快速开始（本地运行）

1. 克隆仓库

```bash
git clone git@github.com:zjuzyt/starship-battle.git
cd starship-battle
```

2. 直接运行（最简单）

```bash
open index.html
```

3. 或使用本地静态服务器（推荐）

```bash
python3 -m http.server 8000
```

打开：

```text
http://127.0.0.1:8000
```

## 项目结构

```text
starship-battle/
├── index.html   # 页面结构与控制按钮
├── styles.css   # UI 与布局样式
├── game.js      # 游戏主逻辑（渲染、碰撞、得分、状态）
├── LICENSE      # MIT License
└── README.md
```

## 开发与贡献

欢迎 Issue 和 PR。

1. Fork 本仓库
2. 新建分支：`git checkout -b feat/your-feature`
3. 提交更改：`git commit -m "feat: add your feature"`
4. 推送分支并发起 Pull Request

## 开源协议

本项目使用 MIT License，详见 [LICENSE](LICENSE)。
