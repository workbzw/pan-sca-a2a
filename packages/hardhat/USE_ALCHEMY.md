# 使用 Alchemy RPC 避免限流

## 当前配置

已配置为**默认使用 Alchemy RPC**，这样可以避免公共 RPC 节点的限流问题。

## Alchemy 的优势

1. **更高的请求限制** - Alchemy 提供更高的 RPC 请求频率限制
2. **更稳定** - 专业的基础设施，减少限流和超时
3. **更好的支持** - 有完整的监控和错误处理

## 如何使用

### 方法 1: 直接部署（推荐）

直接运行部署命令，会自动使用 Alchemy：

```bash
cd packages/hardhat
yarn deploy --network bscTestnet
```

### 方法 2: 确保使用 Alchemy（如果设置了其他 RPC）

如果之前设置了 `BSC_TESTNET_RPC` 环境变量，可以取消设置：

```bash
# 取消设置，使用默认的 Alchemy
unset BSC_TESTNET_RPC

# 然后部署
cd packages/hardhat
yarn deploy --network bscTestnet
```

### 方法 3: 明确指定 Alchemy（可选）

如果想明确指定使用 Alchemy：

```bash
cd packages/hardhat
# 使用你的 Alchemy API Key（从 .env 文件读取）
yarn deploy --network bscTestnet
```

## 检查当前使用的 RPC

部署时会显示使用的 RPC URL，格式为：
```
https://bnb-testnet.g.alchemy.com/v2/YOUR_API_KEY
```

## Alchemy API Key 配置

你的 Alchemy API Key 已配置在 `.env` 文件中：
```
ALCHEMY_API_KEY=your-api-key
```

如果没有配置，会使用默认的 Scaffold-ETH API Key（可能有更严格的限制）。

## 获取自己的 Alchemy API Key（推荐）

1. 访问 https://www.alchemy.com/
2. 注册账号并创建应用
3. 选择 BSC Testnet 网络
4. 获取 API Key
5. 在 `.env` 文件中设置：
   ```
   ALCHEMY_API_KEY=your-api-key
   ```

## 注意事项

- Alchemy 免费层也有请求限制，但对于部署来说通常足够
- 如果仍然遇到限流，可以考虑升级到 Alchemy 的付费计划
- 部署脚本已包含重试机制，会自动处理临时限流

