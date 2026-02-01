/**
 * Foxcode Cache Proxy
 * 
 * 为 Foxcode API 请求注入 metadata.user_id 以启用 Prompt 缓存
 * 
 * @author 琦琦 & 三胖
 * @license MIT
 * @repository https://github.com/user/foxcode-cache-proxy
 */

import { createServer } from 'http';

// ============ 配置 ============
const CONFIG = {
  port: parseInt(process.env.PROXY_PORT || '18800'),
  targetHost: process.env.TARGET_HOST || 'code.newcli.com',
  userId: process.env.USER_ID || 'clawdbot-user',
  
  // 支持的渠道列表
  channels: ['droid', 'aws', 'super', 'ultra'],
  defaultChannel: 'droid',
  
  // 重试配置
  retry: {
    maxAttempts: parseInt(process.env.RETRY_MAX || '3'),
    initialDelayMs: parseInt(process.env.RETRY_DELAY || '1000'),
    maxDelayMs: parseInt(process.env.RETRY_MAX_DELAY || '10000'),
  },
  
  // 超时配置
  timeoutMs: parseInt(process.env.TIMEOUT_MS || '120000'),
};

// ============ 日志 ============
const log = {
  info: (msg) => console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`),
  error: (msg) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`),
  success: (msg) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
  request: (msg) => console.log(`[${new Date().toISOString()}] 📤 ${msg}`),
  response: (msg) => console.log(`[${new Date().toISOString()}] 📥 ${msg}`),
};

log.info('Foxcode Cache Proxy starting...');
log.info(`Port: ${CONFIG.port}`);
log.info(`Target Host: https://${CONFIG.targetHost}`);
log.info(`Channels: ${CONFIG.channels.join(', ')}`);
log.info(`User ID: ${CONFIG.userId}`);
log.info(`Retry: max=${CONFIG.retry.maxAttempts}, delay=${CONFIG.retry.initialDelayMs}ms`);

// ============ 工具函数 ============
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRetryDelay(attempt) {
  const delay = CONFIG.retry.initialDelayMs * Math.pow(2, attempt);
  return Math.min(delay, CONFIG.retry.maxDelayMs);
}

function isRetryableError(error) {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'];
  return retryableCodes.includes(error.code) || 
         error.message?.includes('fetch failed') ||
         error.message?.includes('network');
}

// 从请求路径解析渠道
function parseChannel(url) {
  // 支持格式: /droid/v1/messages, /aws/v1/messages 等
  const match = url.match(/^\/([^\/]+)/);
  if (match && CONFIG.channels.includes(match[1])) {
    return match[1];
  }
  return CONFIG.defaultChannel;
}

// 构建目标URL
function buildTargetUrl(channel) {
  return `https://${CONFIG.targetHost}/claude/${channel}/v1/messages`;
}

// ============ 请求处理 ============
async function handleRequest(req, res) {
  // 健康检查端点
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', channels: CONFIG.channels, timestamp: Date.now() }));
    return;
  }

  // 只处理 POST 请求
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // 解析渠道
  const channel = parseChannel(req.url);
  const targetUrl = buildTargetUrl(channel);

  try {
    // 读取请求体
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString();
    
    // 解析并注入 metadata
    const data = JSON.parse(body);
    data.metadata = { ...data.metadata, user_id: CONFIG.userId };
    
    log.request(`[${channel}] model=${data.model}, messages=${data.messages?.length || 0}`);
    
    // 带重试的转发
    await forwardWithRetry(data, req.headers, res, targetUrl, channel);
    
  } catch (err) {
    log.error(`[${channel}] Request failed: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
}

// ============ 带重试的转发 ============
async function forwardWithRetry(data, headers, res, targetUrl, channel) {
  let lastError;
  
  for (let attempt = 0; attempt < CONFIG.retry.maxAttempts; attempt++) {
    try {
      if (attempt > 0) {
        const delay = getRetryDelay(attempt - 1);
        log.info(`[${channel}] Retry attempt ${attempt}/${CONFIG.retry.maxAttempts} after ${delay}ms`);
        await sleep(delay);
      }
      
      await forwardRequest(data, headers, res, targetUrl, channel);
      return; // 成功则返回
      
    } catch (err) {
      lastError = err;
      
      if (!isRetryableError(err) || attempt === CONFIG.retry.maxAttempts - 1) {
        throw err;
      }
      
      log.error(`[${channel}] Attempt ${attempt + 1} failed: ${err.message}`);
    }
  }
  
  throw lastError;
}

// ============ 转发请求 ============
async function forwardRequest(data, headers, res, targetUrl, channel) {
  const body = JSON.stringify(data);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.timeoutMs);
  
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': headers.authorization,
        'anthropic-version': headers['anthropic-version'] || '2023-06-01',
        'anthropic-beta': headers['anthropic-beta'] || '',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // 转发响应头
    res.writeHead(response.status, {
      'Content-Type': response.headers.get('content-type') || 'application/json',
    });

    // 流式转发响应体
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
    
    log.response(`[${channel}] ${response.status}`);
    
  } finally {
    clearTimeout(timeout);
  }
}

// ============ 启动服务器 ============
const server = createServer(handleRequest);

server.on('error', (err) => {
  log.error(`Server error: ${err.message}`);
  process.exit(1);
});

server.listen(CONFIG.port, '127.0.0.1', () => {
  log.success(`Proxy ready at http://127.0.0.1:${CONFIG.port}`);
  log.info(`Health check: http://127.0.0.1:${CONFIG.port}/health`);
  log.info(`Usage: POST /{channel}/v1/messages`);
  log.info(`  Channels: ${CONFIG.channels.join(', ')}`);
});

// 优雅退出
process.on('SIGTERM', () => {
  log.info('Received SIGTERM, shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  log.info('Received SIGINT, shutting down...');
  server.close(() => process.exit(0));
});
