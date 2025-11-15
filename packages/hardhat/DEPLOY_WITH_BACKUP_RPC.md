# 使用备用 RPC 部署指南

## 问题
Alchemy RPC 节点可能不稳定或限流，导致部署失败。

## 解决方案

### 方法 1: 使用 BSC 官方公共 RPC（推荐）

```bash
cd packages/hardhat
BSC_TESTNET_RPC="https://data-seed-prebsc-1-s1.binance.org:8545/" yarn deploy --network bscTestnet
```

### 方法 2: 使用其他 BSC Testnet 公共 RPC

```bash
# 节点 1
BSC_TESTNET_RPC="https://data-seed-prebsc-1-s1.binance.org:8545/" yarn deploy --network bscTestnet

# 节点 2
BSC_TESTNET_RPC="https://data-seed-prebsc-2-s1.binance.org:8545/" yarn deploy --network bscTestnet

# 节点 3
BSC_TESTNET_RPC="https://data-seed-prebsc-1-s2.binance.org:8545/" yarn deploy --network bscTestnet

# 节点 4
BSC_TESTNET_RPC="https://data-seed-prebsc-2-s2.binance.org:8545/" yarn deploy --network bscTestnet
```

### 方法 3: 只部署 AgentStore（如果其他合约已部署）

```bash
# 删除 AgentStore 部署记录
rm packages/hardhat/deployments/bscTestnet/AgentStore.json

# 使用备用 RPC 部署
BSC_TESTNET_RPC="https://data-seed-prebsc-1-s1.binance.org:8545/" yarn deploy --network bscTestnet
```

### 方法 4: 等待后重试

如果 RPC 节点只是临时限流，可以等待 5-10 分钟后重试：

```bash
cd packages/hardhat
yarn deploy --network bscTestnet
```

## 已优化的配置

- 超时时间已增加到 300 秒（5 分钟）
- 支持通过环境变量 `BSC_TESTNET_RPC` 指定备用 RPC
- 如果 Alchemy 失败，会自动回退到 BSC 官方公共 RPC

