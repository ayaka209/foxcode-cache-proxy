# Foxcode Cache Proxy

为 Foxcode API 请求注入 `metadata.user_id`，启用 Prompt 缓存功能。

## 背景

Foxcode 需要在请求中包含 `metadata.user_id` 字段才能启用 Prompt 缓存。本代理拦截 API 请求，自动注入该字段。

## 功能

- ✅ 自动注入 `metadata.user_id`
- ✅ **多渠道支持** (droid, aws, super, ultra)
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

### 多渠道路由

代理支持多个 Foxcode 渠道，通过请求路径区分：

| 渠道 | 请求地址 | 转发目标 |
|------|----------|----------|
| droid | `http://127.0.0.1:18800/droid/v1/messages` | `/claude/droid/v1/messages` |
| aws | `http://127.0.0.1:18800/aws/v1/messages` | `/claude/aws/v1/messages` |
| super | `http://127.0.0.1:18800/super/v1/messages` | `/claude/super/v1/messages` |
| ultra | `http://127.0.0.1:18800/ultra/v1/messages` | `/claude/ultra/v1/messages` |

### 环境变量配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PROXY_PORT` | 18800 | 代理监听端口 |
| `TARGET_HOST` | code.newcli.com | Foxcode API 地址 |
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

## 配置示例

### Clawdbot

修改 `~/.clawdbot/clawdbot.json`：

```json
{
  "models": {
    "providers": {
      "fox-droid": {
        "baseUrl": "http://127.0.0.1:18800/droid",
        "apiKey": "your-api-key",
        "api": "anthropic-messages"
      },
      "fox-aws": {
        "baseUrl": "http://127.0.0.1:18800/aws",
        "apiKey": "your-api-key",
        "api": "anthropic-messages"
      }
    }
  }
}
```

### OpenCode

修改 `opencode.json`：

```json
{
  "provider": {
    "foxcode-droid": {
      "npm": "@ai-sdk/anthropic",
      "options": {
        "baseURL": "http://127.0.0.1:18800/droid",
        "litellmProxy": true
      }
    },
    "foxcode-aws": {
      "npm": "@ai-sdk/anthropic",
      "options": {
        "baseURL": "http://127.0.0.1:18800/aws",
        "litellmProxy": true
      }
    }
  }
}
```

## 健康检查

```bash
curl http://127.0.0.1:18800/health
# {"status":"ok","channels":["droid","aws","super","ultra"],"timestamp":1234567890}
```

## License

MIT
