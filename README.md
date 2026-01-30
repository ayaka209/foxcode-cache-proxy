# Foxcode Cache Proxy

为 Foxcode API 请求注入 `metadata.user_id`，启用 Prompt 缓存功能。

## 背景

Foxcode (AWS 渠道) 需要在请求中包含 `metadata.user_id` 字段才能启用 Prompt 缓存。本代理拦截 API 请求，自动注入该字段。

## 功能

- ✅ 自动注入 `metadata.user_id`
- ✅ 网络异常自动重试
- ✅ 健康检查端点
- ✅ 流式响应支持
- ✅ Systemd 服务配置

## 安装

```bash
git clone https://github.com/user/foxcode-cache-proxy.git
cd foxcode-cache-proxy
```

## 使用

### 直接运行

```bash
node proxy.js
```

### 环境变量配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PROXY_PORT` | 18800 | 代理监听端口 |
| `TARGET_HOST` | code.newcli.com | Foxcode API 地址 |
| `TARGET_PATH` | /claude/droid | API 路径 |
| `USER_ID` | clawdbot-user | 用于缓存的用户标识 |
| `RETRY_MAX` | 3 | 最大重试次数 |
| `RETRY_DELAY` | 1000 | 初始重试延迟(ms) |
| `TIMEOUT_MS` | 120000 | 请求超时时间(ms) |

### Systemd 服务（推荐）

1. 复制服务文件：

```bash
cp foxcode-proxy.service ~/.config/systemd/user/
```

2. 启用并启动：

```bash
systemctl --user daemon-reload
systemctl --user enable foxcode-proxy
systemctl --user start foxcode-proxy
```

3. 查看状态：

```bash
systemctl --user status foxcode-proxy
journalctl --user -u foxcode-proxy -f
```

## 配置 Clawdbot

修改 `~/.clawdbot/clawdbot.json`，将 `baseUrl` 指向本地代理：

```json
{
  "models": {
    "providers": {
      "fox": {
        "baseUrl": "http://127.0.0.1:18800",
        "apiKey": "your-api-key",
        "api": "anthropic-messages",
        "models": [...]
      }
    }
  }
}
```

## 健康检查

```bash
curl http://127.0.0.1:18800/health
# {"status":"ok","timestamp":1234567890}
```

## License

MIT
