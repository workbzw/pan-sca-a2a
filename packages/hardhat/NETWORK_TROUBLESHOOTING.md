# 网络连接问题排查指南

## 当前问题
`ConnectTimeoutError: Connect Timeout Error` - 无法连接到 RPC 节点

## 可能原因

### 1. 网络连接问题 🌐
- 防火墙阻止连接
- 代理服务器配置问题
- DNS 解析失败
- 网络不稳定

### 2. RPC 节点不可用 ⚠️
- 公共 RPC 节点可能暂时不可用
- 节点维护或限流

### 3. 需要代理配置 🔒
- 如果在中国大陆，可能需要配置代理

## 解决方案

### 方案 1: 测试 RPC 连接（推荐先执行）

```bash
cd packages/hardhat
./test-rpc-connection.sh
```

这个脚本会测试多个 RPC 节点，找到可用的节点。

### 方案 2: 使用 Alchemy RPC（如果可用）

```bash
cd packages/hardhat
yarn deploy --network bscTestnet
```

当前配置已默认使用 Alchemy RPC。

### 方案 3: 配置代理（如果需要）

```bash
# 设置 HTTP 代理
export HTTP_PROXY="http://your-proxy:port"
export HTTPS_PROXY="http://your-proxy:port"

# 然后部署
cd packages/hardhat
yarn deploy --network bscTestnet
```

### 方案 4: 使用其他 RPC 提供商

#### 4.1 使用 QuickNode（需要注册）
```bash
BSC_TESTNET_RPC="https://your-quicknode-url" yarn deploy --network bscTestnet
```

#### 4.2 使用 Infura（需要注册）
```bash
BSC_TESTNET_RPC="https://bsc-testnet.infura.io/v3/YOUR-PROJECT-ID" yarn deploy --network bscTestnet
```

#### 4.3 使用 Ankr（公共节点）
```bash
BSC_TESTNET_RPC="https://rpc.ankr.com/bsc_testnet_chapel" yarn deploy --network bscTestnet
```

### 方案 5: 使用本地 BSC 测试网节点

如果你运行了本地 BSC 测试网节点：

```bash
BSC_TESTNET_RPC="http://localhost:8545" yarn deploy --network bscTestnet
```

### 方案 6: 检查网络连接

```bash
# 测试基本网络连接
ping -c 3 bnb-testnet.g.alchemy.com

# 测试 HTTPS 连接
curl -I https://bnb-testnet.g.alchemy.com

# 测试 DNS 解析
nslookup bnb-testnet.g.alchemy.com
```

### 方案 7: 增加连接超时（已配置）

当前配置已设置超时时间为 300 秒（5 分钟）。如果仍然超时，可能需要：
1. 检查网络稳定性
2. 使用更稳定的 RPC 提供商
3. 配置代理

## 推荐的 RPC 提供商（按稳定性排序）

1. **Alchemy** - 当前默认，需要 API Key（已配置）
2. **QuickNode** - 商业服务，稳定但需要注册
3. **Infura** - 商业服务，稳定但需要注册
4. **Ankr** - 公共节点，免费但可能限流
5. **BSC 官方节点** - 公共节点，可能不稳定

## 临时解决方案

如果所有 RPC 都不可用，可以：

1. **等待一段时间后重试** - 可能是临时网络问题
2. **使用 VPN** - 如果网络环境受限
3. **使用其他网络** - 可以先在本地 Hardhat 网络测试
4. **联系网络管理员** - 如果是企业网络，可能需要开放端口

## 本地测试（无需网络）

如果只是想测试合约功能，可以使用本地 Hardhat 网络：

```bash
cd packages/hardhat
yarn deploy --network hardhat
```

这会使用本地 Hardhat 网络，不需要外部 RPC 连接。

