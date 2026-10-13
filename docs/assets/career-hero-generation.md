# 横幅生成记录

2026-10-13，使用内置 ImageGen 编辑已选品牌图，改为 Logo、文案、纸张插图横向排列。实际输出 2172 × 724（3:1），替换原 1942 × 809 图片；同宽显示高度约减少 20%。原图备份留在开发任务目录，不进入发布仓库。

最终编辑提示词（尺寸是生成目标，实际结果以上述尺寸为准）：

```text
Edit this banner by making a precise narrow panoramic crop/recomposition. The final actual image must be a thin strip: width 2400, height 480 (5:1). Remove all empty white/ivory bands above and below the artwork. Full bleed artwork must reach all four edges. Keep the horizontal arrangement of career. on the left, Chinese headline beside it, paper collage on the right. Keep these exact texts completely visible: career. / 把经历，写成下一步。 / 与 Agent 协作，整理你的职业资料 . Preserve forest green serif typography, sage green dot, cream paper texture, lighting, cards and leaves. If needing to adjust, scale the text smaller to fit the slim strip; allow papers to crop naturally at the edges. Do NOT return a tall canvas or empty top/bottom padding. No frame and no additional text. User explicitly wants a short-height single-line header ribbon instead of a large hero.
```
