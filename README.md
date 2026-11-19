<div align="center">

# 🐱 WorkBuddy 加油站自动签到

**WorkBuddy「Buddy 加油站」每日签到 + 派猫猫旅行全自动闭环**

接口直签 · 无需 GUI 点击 / OCR · 支持 5.6.2+ 加密登录态 · 微信推送 · 零第三方依赖

</div>

---

## ✨ 功能

- 📅 **每日自动签到**：查询状态 → 未签自动领取（+100 积分/天），已签安全跳过（幂等，绝不重复领取）
- 🐱 **派猫猫旅行闭环**：先领取到达奖励 → 后派出 Buddy 旅行，全自动；达每日上限自动停手
- 🔐 **新版加密登录态支持**：自动识别 5.6.2+ 的 `$wbEncrypted`（AES-256-GCM）信封并通过官方 Electron 原生绑定解密，旧版明文登录态同样兼容
- 🍎 **跨平台**：macOS / Windows / Linux 全平台登录态路径自动探测
- 📢 **失败推送**：企业微信群机器人 / PushPlus / Bark（可选，配置缺失静默跳过）
- 🔔 **桌面通知**：macOS toast / Windows 气球 / Linux notify-send（跨平台 best-effort）
- 🩺 **环境自检**：一条命令检查 Python / 登录态 / 网络 / 桌面会话 / 推送配置
- 📦 **零依赖**：纯 Python 标准库，单文件脚本，无需 `pip install`

## 🚀 快速开始

### 前置条件

1. 本机已安装并登录 [WorkBuddy](https://www.workbuddy.cn) 客户端（脚本只读取登录态，绝不修改）
2. Python 3.6+（macOS/Linux 一般自带；Windows 建议安装时勾选 Add to PATH）

### 运行

```bash
git clone https://github.com/wuxiumu/workbuddy-checkin.git
cd workbuddy-checkin

# 签到 + 派猫猫旅行全自动闭环（默认）
python3 workbuddy_checkin.py

# 首次使用建议先自检（只读，不签到）
python3 workbuddy_checkin.py --diagnose
```

输出为结构化 JSON（示例见 [examples/output-sample.json](examples/output-sample.json)）：

```json
{
  "status": "ok",
  "action": "clicked",
  "points": 100,
  "balance": 4900,
  "msg": "领取成功，+100 积分，连续第 50 天，当前积分余额 4900 ｜ 派猫猫旅行：…"
}
```

### 命令一览

```text
python workbuddy_checkin.py                    # 签到 + 旅行闭环（默认）
python workbuddy_checkin.py --no-travel        # 只签到，跳过旅行
python workbuddy_checkin.py --check-only       # 仅查询状态（只读）
python workbuddy_checkin.py travel             # 只查旅行状态（只读）
python workbuddy_checkin.py travel --travel-auto  # 只跑旅行闭环（不签到）
python workbuddy_checkin.py --location 3       # 指定派遣地点（缺省随机）
python workbuddy_checkin.py --no-notify        # 跳过推送与桌面通知
python workbuddy_checkin.py --diagnose         # 环境自检
python workbuddy_checkin.py --init-config      # 生成推送配置模板
```

退出码：成功 `0` / 失败 `1`，方便接入任何调度器。

## ⏰ 定时运行

**macOS launchd**（保存为 `~/Library/LaunchAgents/com.workbuddy.checkin.plist`）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.workbuddy.checkin</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>/Users/你的用户名/workbuddy-checkin/workbuddy_checkin.py</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>30</integer></dict>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.workbuddy.checkin.plist
```

**Linux crontab**（每天 09:30）：

```cron
30 9 * * * /usr/bin/python3 /path/to/workbuddy-checkin/workbuddy_checkin.py
```

> ⚠️ 脚本依赖**本机登录态文件与 WorkBuddy 客户端二进制**（仅新版加密登录态解密时需要），因此不支持 GitHub Actions 等云端托管——请在你登录了 WorkBuddy 的电脑上运行。Windows 下建议用「任务计划程序」。

## 🔐 加密登录态解密原理（5.6.2+）

新版 WorkBuddy 客户端把登录态中的 `accessToken` / `refreshToken` 等字段存为加密信封：

```json
{ "$wbEncrypted": 1, "envelope": "base64(JSON{suite,keyId,nonce,authTag,ciphertext})" }
```

- 算法：AES-256-GCM（sym-v1），密钥 = SHA-256(`atRestSecretKey`)
- `atRestSecretKey` 由定制 Electron 框架的原生绑定 `electron_browser_workbuddy_storage.loggerGet()` 在运行时返回（二进制内混淆，静态提取不可行）
- 本项目随附 `wb_auth_decrypt.js`：以 `ELECTRON_RUN_AS_NODE=1` 启动**本机已安装的 WorkBuddy Electron** 完成解密，主脚本检测到信封时自动调用
- 密钥材料只存在于子进程内存，绝不落盘、绝不打印

旧版客户端的明文登录态无需任何额外处理，直接兼容。

## 📲 推送配置（可选）

```bash
python3 workbuddy_checkin.py --init-config   # 生成模板
cp ~/.workbuddy/scripts/notify_config.json.example ~/.workbuddy/scripts/notify_config.json
# 填入你的通道密钥
```

```json
{
  "enabled": true,
  "success_notify": false,
  "wecom_webhook": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY",
  "pushplus_token": "YOUR_PUSHPLUS_TOKEN",
  "bark_url": "https://api.day.app/YOUR_BARK_KEY/"
}
```

- 默认只在**签到失败**时推送（网络故障 / 登录态过期 / 接口异常）
- `success_notify: true` 可开启每日成功播报
- 配置文件只存在于本机，永不进入仓库

## 🛡️ 安全与隐私约定

- ✅ 只读取本机登录态文件，绝不写入或修改
- ✅ 任何输出都不含真实 token / 密钥（仅脱敏形态如 `eyJhbG...4UvA`）
- ✅ 推送密钥只存在于本地配置文件，仓库内无任何真实凭据
- ✅ 旅行派遣前必查每日上限，达上限绝不发写请求
- ✅ 已到达的旅行奖励不会丢失，下次运行自动补领

## ⚠️ 免责声明

- 本项目仅供个人学习与自己账号的日常自动化使用，请勿用于批量注册、刷分或其他违反 WorkBuddy 服务条款的用途
- 接口为客户端私有接口，未来版本变更可能导致失效（脚本已做多形态兼容与幂等保护）
- 由此产生的一切后果（如账号被限制）由使用者自行承担

## 📂 项目结构

```text
workbuddy-checkin/
├── workbuddy_checkin.py      # 主脚本（签到 + 旅行 + 推送 + 通知，零依赖）
├── wb_auth_decrypt.js        # 加密登录态解密助手（配合本机 Electron 使用）
├── examples/
│   └── output-sample.json    # 运行输出示例（脱敏）
├── LICENSE
└── README.md
```

## 📄 License

[MIT](LICENSE) © wuxiumu
