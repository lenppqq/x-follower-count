# X 用户列表显示粉丝数

Tampermonkey 油猴脚本：在 X (Twitter) 的 followers / following 等用户列表里，给每个用户显示粉丝数，按阈值高亮，并可过滤低粉丝用户。

## 安装

装好 [Tampermonkey](https://www.tampermonkey.net/) 后，打开下面的链接，点「安装」：

https://raw.githubusercontent.com/lenppqq/x-follower-count/main/x-follower-count.user.js

Chrome 需要在扩展详情里打开「允许用户脚本」（或开发者模式）。

## 功能

- **粉丝数标签**：每个用户 `@handle` 旁边显示粉丝数，数据直接取自页面，不额外请求接口。
- **高亮阈值**：默认 3000+ 蓝色边框，5000+ 橙色加粗，10000+ 彩虹动态边框。点任意粉丝数标签打开设置，可增删阈值、换样式。
- **过滤栏**：列表页 tabs 下方，可过滤粉丝少于指定数量的用户，三种方式：
  - 彻底隐藏
  - 最小化（缩成一行）
  - 头像排（连续的低粉丝用户合并成一排头像）

设置保存在浏览器的 localStorage 里。

## 更新

脚本带有 `@updateURL`，Tampermonkey 会定期检查本仓库 `main` 分支。发布新版本时**必须提高 `@version`**，否则不会触发更新。想立即更新可在 Tampermonkey 管理面板里手动「检查更新」。
