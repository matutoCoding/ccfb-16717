# Bowl Studio · 碗池曲面设计与滑行预览

浏览器端碗池混凝土曲面设计、曲率检查、滑行物理预览和施工放样系统。技术栈为 **TypeScript + Vue 3 + Vite + Tailwind CSS 4 + Three.js + IndexedDB**。

## 启动

需要先安装依赖（按你的习惯由主人手动执行）：

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
pnpm preview
```

类型检查：

```bash
pnpm typecheck
```

## 曲面精度自检

核心几何不依赖 Three.js / DOM，可直接运行精度脚本：

```bash
pnpm verify
```

也可以用 Node 24 原生 TS 剥离执行：

```bash
node --experimental-strip-types --loader ./scripts/extensionless-loader.mjs scripts/verify_precision.ts
```

自检会对两个出厂项目：

- 青釉肾形碗
- 三碗连通大池

沿整个池口按 0.5m 站位生成法向截面，将每个截面点与设定半径的理论圆弧比较，并检查放样点标高是否与 `BowlSurface.elevation()` 一致。当前结果约为：

- 肾形碗最大径向偏差 `< 0.3 mm`
- 三碗连通最大径向偏差 `< 0.5 mm`
- 放样点导出四舍五入后的一致性误差 `< 0.005 mm`
- 原始标高一致性误差 `0 mm`

硬精度口径：截面点到理论圆心的半径与设定 `R` 的差，而不是粗略的竖直坐标差。

## 页面

1. **项目列表**：新建、搜索、复制、删除项目；首次打开自动写入两个测试项目。
2. **池型设计**：SVG 平面编辑器拖动池口控制点，参数化生成垂直段、圆弧过渡段和带坡度池底；自动保存 IndexedDB 历史版本。
3. **曲面检查**：主曲率云图、曲率突变标红、法向截面 R 拟合、超差坐标列表。
4. **滑行预览**：重力 / 阻力沿曲面弧长积分，显示速度、时间、最大爬升高度和轨迹；支持第一视角。
5. **施工放样**：规则网格标高 CSV、法向截面 SVG / 全部切片 HTML、混凝土方量、开挖方量和钢筋网面积。
6. **设置**：测量交付信息、钢筋层数 / 搭接系数、JSON 备份导入导出、重建测试项目。

## 核心实现

```text
src/domain/geometry/
  curve.ts          闭合 Catmull-Rom 采样、点内判断、最近点、内法向
  bowl_surface.ts   唯一曲面标高内核：池口距离场 + R 圆弧剖面 + 池底坡度
  inspection.ts     法向截面理论圆弧比对、圆拟合、Hessian 曲率
  survey.ts         放样网格、CSV、曲面面积 / 混凝土 / 钢筋统计
  loft.ts           法向模板切片和 SVG 出图
  ride.ts           截面轨道、重力切向加速度和滑行状态积分

src/three/
  BowlViewer.ts          Three.js 场景、相机、Skier、轨迹、云图和放样点
  bowl_geometry.ts       池底网格、解析圆弧扫掠、直壁、甲板开洞
  coping_builder.ts      压顶石扫掠、分缝、金属圆钢护边
```

所有放样点、滑行高度和统计数据都调用同一个 `BowlSurface.elevation(x, z)`，避免“模型一套标高、表格另一套标高”。

## 数据

IndexedDB 数据库：`bowl-studio-db`

- `projects`：项目主记录和完整设计 JSON
- `versions`：自动保存 / 手动版本

设置和钢筋参数保存在 `localStorage`。

## 已知工程边界

- 当前平面编辑以单个闭合外轮廓驱动一个碗池 / 多叶连通池；多个独立碗可通过多个闭合轮廓继续扩展，几何内核已遍历 `outlines[]`。
- 尖锐池口或过渡半径大于局部法向可达距离时，检查页会如实列出超差截面；这是施工几何不可行区域，不应通过渲染细分掩盖。
- Three.js 画面用于可视化；施工交付标高以 CSV 和曲面内核数值为准。
