# 使用 VPN 部署指南

## ✅ 已找到可用的 RPC 节点

通过测试，发现 **PublicNode** RPC 节点可用：
- URL: `https://bsc-testnet-rpc.publicnode.com`
- 区块高度: 正常同步
- 延迟: ~736ms

## 部署方法

### 方法 1: 使用 PublicNode RPC（推荐）

```bash
cd packages/hardhat
BSC_TESTNET_RPC="https://bsc-testnet-rpc.publicnode.com" yarn deploy --network bscTestnet
```

**注意**: 如果提示输入密码，这是因为你的私钥是加密的。输入你之前设置加密私钥时的密码。

### 方法 2: 使用未加密的私钥（如果不想输入密码）

如果你有未加密的私钥，可以通过环境变量直接使用：

```bash
cd packages/hardhat
export __RUNTIME_DEPLOYER_PRIVATE_KEY="你的私钥（0x开头）"
BSC_TESTNET_RPC="https://bsc-testnet-rpc.publicnode.com" yarn deploy --network bscTestnet
```

### 方法 3: 使用部署脚本（自动处理密码）

```bash
cd packages/hardhat
BSC_TESTNET_RPC="https://bsc-testnet-rpc.publicnode.com" yarn hardhat run scripts/runHardhatDeployWithPK.ts --network bscTestnet
```

## 其他可用的 RPC 节点

如果 PublicNode 不可用，可以尝试：

```bash
# 1RPC (需要测试)
BSC_TESTNET_RPC="https://1rpc.io/bnb/testnet" yarn deploy --network bscTestnet

# Ankr (需要注册获取 API Key)
BSC_TESTNET_RPC="https://rpc.ankr.com/bsc_testnet/YOUR_API_KEY" yarn deploy --network bscTestnet
```

## 测试 RPC 连接

如果部署失败，可以先用脚本测试 RPC 连接：

```bash
cd packages/hardhat
node scripts/testRpcWithNode.js
```

这个脚本会测试多个 RPC 节点，并显示哪些可用。

## 常见问题

### Q: 为什么需要输入密码？
A: 你的私钥是加密存储的（`DEPLOYER_PRIVATE_KEY_ENCRYPTED`），需要密码来解密。这是为了安全考虑。

### Q: 忘记密码怎么办？
A: 你需要重新导入私钥或生成新账户。可以使用：
```bash
yarn account:import  # 导入新私钥
# 或
yarn generate        # 生成新账户
```

### Q: 如何避免每次输入密码？
A: 使用未加密的私钥（方法 2），但要注意安全，不要将私钥提交到 Git。

## 下一步

1. 运行部署命令（方法 1）
2. 输入密码（如果提示）
3. 等待部署完成

部署成功后，合约地址会显示在终端，并自动更新到 `packages/nextjs/contracts/deployedContracts.ts`。

