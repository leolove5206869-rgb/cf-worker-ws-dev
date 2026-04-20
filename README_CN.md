# EDtunnel

<p align="center">
  <img src="https://raw.githubusercontent.com/6Kmfi6HP/EDtunnel/refs/heads/main/image/logo.png" alt="EDtunnel" style="margin-bottom: -50px;">
</p>

基于 Cloudflare Workers 和 Pages 的代理工具，支持多种协议和配置选项。

[![Repository](https://img.shields.io/badge/View%20on-GitHub-blue.svg)](https://github.com/6Kmfi6HP/EDtunnel)
[![Telegram](https://img.shields.io/badge/Discuss-Telegram-blue.svg)](https://t.me/edtunnel)

**[English Documentation](README.md)**

## 特性

- 支持 Cloudflare Workers 和 Pages 部署
- 支持多 UUID 配置
- 支持自定义代理 IP 和端口
- 支持 SOCKS5 和 HTTP 代理
- **支持 Trojan 协议**，自动检测协议类型
- **支持 VLESS 出站代理**，完整 UDP 支持
- **支持多代理轮换**，自动故障转移
- 提供自动配置订阅链接
- 支持 URL 查询参数覆盖配置
- 支持路径参数配置代理（`/socks5://`、`/http://`、`/vless://`）
- 简单易用的部署流程

## 快速部署

### 在 Pages.dev 部署

1. 观看部署教程视频：[YouTube 教程](https://www.youtube.com/watch?v=8I-yTNHB0aw)
2. 克隆此仓库并在 Cloudflare Pages 中部署

### 在 Worker.dev 部署

1. 从[这里](https://github.com/6Kmfi6HP/EDtunnel/blob/main/_worker.js)复制 `_worker.js` 代码
2. 或者点击下方按钮一键部署：

   [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/6Kmfi6HP/EDtunnel)

## 配置说明

### 环境变量配置

| 变量名 | 是否必需 | 示例 | 说明 |
|--------|----------|------|------|
| `UUID` | 否 | 单个: `12345678-1234-1234-1234-123456789012`<br>多个: `uuid1,uuid2,uuid3` | 用户识别码 |
| `PROXYIP` | 否 | `1.1.1.1` 或 `example.com`<br>多个: `1.1.1.1:9443,2.2.2.2:8443` | 自定义代理IP和端口 |
| `SOCKS5` | 否 | `user:pass@host:port`<br>多个: `user1:pass1@host1:port1,user2:pass2@host2:port2` | SOCKS5代理配置 |
| `SOCKS5_RELAY` | 否 | `true` 或 `false` | 启用SOCKS5流量转发 |
| `TROJAN_PASSWORD` | 否 | `your-password` | Trojan密码（不设置则使用UUID） |
| `VLESS_OUTBOUND` | 否 | `vless://uuid@host:port?type=ws&security=tls` | VLESS出站代理URL |
| `PROXY_TIMEOUT` | 否 | `1500` | 代理连接超时（毫秒，默认：1500） |
| `PROXY_FALLBACK` | 否 | `true` 或 `false` | 代理失败时回退到直连（默认：true） |

### URL 查询参数配置

您可以使用 URL 查询参数直接覆盖环境变量配置，这些参数的优先级高于环境变量。出于安全考虑，UUID 不能通过 URL 查询参数设置。

| 查询参数 | 对应环境变量 | 示例 | 说明 |
|----------|--------------|------|------|
| `proxyip` | `PROXYIP` | `?proxyip=1.1.1.1:443` | 覆盖代理IP和端口 |
| `socks5` | `SOCKS5` | `?socks5=user:pass@host:port` | 覆盖SOCKS5代理配置 |
| `http` | - | `?http=user:pass@host:port` | HTTP CONNECT代理配置 |
| `vless` | `VLESS_OUTBOUND` | `?vless=vless://uuid@host:port` | 覆盖VLESS出站代理 |
| `globalproxy` | - | `?globalproxy` | 启用全局代理模式（转发所有流量） |

> **安全说明**：UUID 必须通过环境变量或配置文件设置，不能通过 URL 参数设置，以防止未授权修改用户身份。

### 路径参数配置

您也可以通过 URL 路径配置代理：

| 路径格式 | 示例 | 说明 |
|----------|------|------|
| `/proxyip=` | `/proxyip=1.1.1.1:443` | 通过路径设置代理IP |
| `/socks5://` | `/socks5://user:pass@host:port` | 通过路径设置SOCKS5代理 |
| `/http://` | `/http://user:pass@host:port` | 通过路径设置HTTP CONNECT代理 |
| `/vless://` | `/vless://uuid@host:port?...` | 通过路径设置VLESS出站代理 |
| `/gvless=` | `/gvless=base64编码的URL` | VLESS出站代理（全局模式，base64编码） |

#### 使用示例

1. 临时更改代理IP：
   ```text
   https://your-domain.workers.dev/?proxyip=another-proxy-ip:port
   ```

2. 组合多个参数：
   ```text
   https://your-domain.workers.dev/?proxyip=1.1.1.1:443&socks5_relay=true
   ```

3. 应用于特定路径：
   ```text
   https://your-domain.workers.dev/sub/your-uuid?proxyip=1.1.1.1:443
   ```

#### 特性说明

- 优先级：URL参数 > 环境变量 > 默认值
- 临时性：这些更改仅对当前请求有效，不会永久修改配置
- 可组合：可以组合多个参数实现复杂配置调整
- 适用场景：快速测试、临时切换配置、第三方系统动态调用

#### URL 格式注意事项

- 确保查询参数使用正确的格式：`?参数名=值`。问号 `?` 不应被URL编码（`%3F`）。
- 如果您看到像 `/%3Fproxyip=value` 这样的URL，这不会正确工作，应改为 `/?proxyip=value`。
- 本项目现已支持处理编码在路径中的查询参数，但建议使用标准格式以确保最佳兼容性。

### 非443端口配置

1. 访问 `https://proxyip.edtunnel.best/`
2. 输入 `ProxyIP:proxyport` 并点击检查
3. 当显示 `Proxy IP: true` 时可用
4. 在 Worker 中配置：`PROXYIP=211.230.110.231:50008`

注意：带端口的代理IP可能在某些仅支持HTTP的Cloudflare站点上无效。

### UUID 配置方法

#### 方法一

在 `wrangler.toml` 文件中设置（不推荐在公共仓库中使用）

```toml
[vars]
UUID = "your-uuid-here"
```

#### 方法二

在 Cloudflare Dashboard 的环境变量中设置（推荐方式）

## 重要提示：多项配置分隔符

所有多项配置必须使用英文逗号(,)分隔，不能使用中文逗号(，)

**正确示例：**

```bash
# UUID多个配置
UUID=uuid1,uuid2,uuid3

# SOCKS5多个代理
SOCKS5=192.168.1.1:1080,192.168.1.2:1080

# PROXYIP多个地址
PROXYIP=1.1.1.1:443,2.2.2.2:443
```

**错误示例：**

```bash
# 错误：使用中文逗号
UUID=uuid1，uuid2，uuid3

# 错误：使用中文逗号
SOCKS5=192.168.1.1:1080，192.168.1.2:1080
```

## 快速使用

### 自动配置订阅

使用以下链接获取自动配置：

```text
https://sub.xf.free.hr/auto
```

### 查看配置

- 访问您的域名：`https://your-domain.pages.dev`
- 使用特定UUID：`/sub/[uuid]`
- 查看完整配置：直接访问域名根路径
- 获取订阅内容：访问 `/sub/[uuid]`

## 高级配置

### Trojan 协议支持

EDtunnel 现已支持 Trojan 协议，可自动检测协议类型：

- 默认密码使用 UUID（如未设置 `TROJAN_PASSWORD`）
- 配置页面自动生成 Trojan 订阅链接
- 访问 `/trojan/[uuid]` 获取纯 Trojan 订阅

### HTTP 代理支持

作为 SOCKS5 的替代方案，您可以使用 HTTP CONNECT 代理：

```bash
# 通过 URL 路径
https://your-domain.workers.dev/http://user:pass@proxy-host:port/sub/uuid

# 通过 URL 参数
https://your-domain.workers.dev/?http=user:pass@proxy-host:port
```

### VLESS 出站代理

将流量通过外部 VLESS 服务器转发，支持完整 UDP：

```bash
# 环境变量
VLESS_OUTBOUND=vless://uuid@remote-server:443?type=ws&security=tls&path=/ws

# 通过 URL 路径
https://your-domain.workers.dev/vless://uuid@host:port?type=ws&security=tls/sub/your-uuid

# 通过 URL 参数
https://your-domain.workers.dev/?vless=vless://uuid@host:port
```

### 多UUID支持

您可以通过以下方式配置多个UUID：

1. 环境变量方式：
   ```bash
   UUID=uuid1,uuid2,uuid3
   ```

2. 配置文件方式：
   ```toml
   [vars]
   UUID = "uuid1,uuid2,uuid3"
   ```

### SOCKS5代理配置

支持以下格式：

- 基础格式：`host:port`
- 认证格式：`username:password@host:port`
- 多代理格式（使用英文逗号分隔）：`proxy1,proxy2,proxy3`

#### 配置示例

1. 单个代理：

```bash
# 基础格式
SOCKS5=192.168.1.1:1080

# 带认证格式
SOCKS5=user:pass@192.168.1.1:1080
```

2. 多个代理（使用英文逗号分隔）：

```bash
# 多个基础代理
SOCKS5=192.168.1.1:1080,192.168.1.2:1080,192.168.1.3:1080

# 多个带认证代理
SOCKS5=user1:pass1@host1:port1,user2:pass2@host2:port2

# 混合格式
SOCKS5=192.168.1.1:1080,user:pass@192.168.1.2:1080,192.168.1.3:1080
```

#### SOCKS5 代理负载均衡

当配置多个代理时，系统会自动进行负载均衡：

- 随机选择
- 自动故障转移
- 支持混合认证方式

#### SOCKS5_RELAY 设置

启用 SOCKS5 全局转发：

```bash
SOCKS5_RELAY=true
```

### 多代理轮换和故障转移

配置多个代理地址时，系统提供以下功能：

- **随机轮换**：自动从可用代理中随机选择
- **连接超时**：通过 `PROXY_TIMEOUT` 配置（默认：1500毫秒）
- **自动故障转移**：失败时尝试下一个代理
- **直连回退**：所有代理失败时回退到直连（通过 `PROXY_FALLBACK` 配置）

```bash
# 配置超时时间（毫秒）
PROXY_TIMEOUT=2000

# 禁用直连回退
PROXY_FALLBACK=false
```

注意事项：

- 确保代理服务器稳定可用
- 建议使用私有代理以提高安全性
- 多代理配置时使用英文逗号分隔
- 支持动态添加和移除代理

## 注意事项

- 带端口的代理IP可能在某些仅HTTP的Cloudflare站点上无效
- 多UUID配置时使用英文逗号分隔
- 建议通过环境变量设置敏感信息
- 定期更新以获取最新功能和安全修复

## 环境变量设置

### Workers.dev 设置

在 Workers 设置页面配置环境变量
![workers](image/image-1.png)

### Pages.dev 设置

在 Pages 设置页面配置环境变量
![pages](image/image-2.png)

## 获取帮助

- Telegram 群组：[EDtunnel Group](https://t.me/edtunnel)
- GitHub 仓库：[EDtunnel](https://github.com/6Kmfi6HP/EDtunnel)
- 问题反馈：[创建新问题](https://github.com/6Kmfi6HP/EDtunnel/issues)
- 功能建议：[提交建议](https://github.com/6Kmfi6HP/EDtunnel/discussions)

## 贡献指南

欢迎提交 Pull Request 来改进项目！请确保：

1. 代码符合项目规范
2. 添加必要的测试
3. 更新相关文档
4. 描述清楚改动原因

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## Star 历史

<a href="https://star-history.com/#6Kmfi6HP/EDtunnel&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=6Kmfi6HP/EDtunnel&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=6Kmfi6HP/EDtunnel&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=6Kmfi6HP/EDtunnel&type=Date" />
  </picture>
</a>
