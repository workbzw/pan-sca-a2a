# RPC 限流问题解决方案

## 问题原因

`ProviderError: Unable to complete request at this time` 通常是因为：

1. **RPC 节点限流** - 公共 RPC 节点（如 PublicNode）有请求频率限制
2. **部署需要大量调用** - 每个合约部署需要：
   - 发送交易
   - 等待区块确认
   - 查询交易状态
   - 验证部署结果
3. **短时间内大量请求** - 4 个合约连续部署会触发限流

## 已实施的优化

### 1. 自动重试机制
- 每个合约部署失败时会自动重试（最多 5-7 次）
- 每次重试前等待 10-15 秒，避免立即重试触发限流
- 重试延迟会逐渐增加（指数退避）

### 2. 部署间隔
- 每个合约部署之间等待 3 秒
- 给 RPC 节点时间恢复

### 3. 错误识别
- 自动识别限流错误
- 只对限流错误进行重试

## 立即尝试

### 方法 1: 使用优化后的部署脚本（推荐）

```bash
cd packages/hardhat
BSC_TESTNET_RPC="https://bsc-testnet-rpc.publicnode.com" yarn deploy --network bscTestnet
```

脚本会自动处理限流，如果遇到限流会等待并重试。

### 方法 2: 分步部署（如果方法 1 仍然失败）

如果一次性部署仍然失败，可以分步部署：

```bash
cd packages/hardhat

# 步骤 1: 部署 IdentityRegistry
BSC_TESTNET_RPC="https://bsc-testnet-rpc.publicnode.com" yarn hardhat deploy --tags IdentityRegistry --network bscTestnet

# 等待 30 秒
sleep 30

# 步骤 2: 部署 ReputationRegistry
BSC_TESTNET_RPC="https://bsc-testnet-rpc.publicnode.com" yarn hardhat deploy --tags ReputationRegistry --network bscTestnet

# 等待 30 秒
sleep 30

# 步骤 3: 部署 ValidationRegistry
BSC_TESTNET_RPC="https://bsc-testnet-rpc.publicnode.com" yarn hardhat deploy --tags ValidationRegistry --network bscTestnet

# 等待 30 秒
sleep 30

# 步骤 4: 部署 AgentStore
BSC_TESTNET_RPC="https://bsc-testnet-rpc.publicnode.com" yarn hardhat deploy --tags AgentStore --network bscTestnet
```

### 方法 3: 等待后重试

如果 RPC 节点只是临时限流，等待 5-10 分钟后重试：

```bash
cd packages/hardhat
BSC_TESTNET_RPC="https://bsc-testnet-rpc.publicnode.com" yarn deploy --network bscTestnet
```

### 方法 4: 使用付费 RPC 服务（最稳定）

公共 RPC 节点都有限流，如果经常部署，建议使用付费服务：

#### 4.1 Alchemy（推荐）
1. 注册账号: https://www.alchemy.com/
2. 创建 BSC Testnet 应用
3. 获取 API Key
4. 使用：
```bash
export ALCHEMY_API_KEY="your-api-key"
cd packages/hardhat
yarn deploy --network bscTestnet
```

#### 4.2 QuickNode
1. 注册账号: https://www.quicknode.com/
2. 创建 BSC Testnet 端点
3. 获取 RPC URL
4. 使用：
```bash
BSC_TESTNET_RPC="https://your-quicknode-url" yarn deploy --network bscTestnet
```

#### 4.3 Infura
1. 注册账号: https://infura.io/
2. 创建项目
3. 获取 BSC Testnet RPC URL
4. 使用：
```bash
BSC_TESTNET_RPC="https://bsc-testnet.infura.io/v3/YOUR-PROJECT-ID" yarn deploy --network bscTestnet
```

## 检查部署状态

如果部署过程中断，可以检查哪些合约已部署：

```bash
cd packages/hardhat
ls -la deployments/bscTestnet/
```

如果某些合约已部署，可以只部署未部署的合约。

## 建议

1. **首次部署**: 使用方法 1（自动重试），通常可以成功
2. **如果仍然失败**: 使用方法 2（分步部署），更稳定但需要手动操作
3. **长期使用**: 使用方法 4（付费 RPC），最稳定且无限流

## 常见问题

### Q: 为什么 PublicNode 测试可用但部署失败？
A: 测试只需要 1 次 RPC 调用，部署需要几十次调用，触发限流。

### Q: 重试多少次会成功？
A: 通常 2-3 次重试就能成功，如果 5 次都失败，建议等待更长时间或使用分步部署。

### Q: 可以增加重试次数吗？
A: 可以，但建议不超过 10 次，否则可能浪费太多时间。如果 10 次都失败，可能是 RPC 节点完全不可用。

