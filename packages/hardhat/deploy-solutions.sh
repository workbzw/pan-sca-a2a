#!/bin/bash

# 部署解决方案脚本
# 提供多个 RPC 节点选项

echo "🚀 Agent Store 部署解决方案"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "请选择部署方式:"
echo "1. 使用 BSC 官方 RPC 节点 1 (默认)"
echo "2. 使用 BSC 官方 RPC 节点 2"
echo "3. 使用 BSC 官方 RPC 节点 3"
echo "4. 使用带重试机制的部署脚本"
echo "5. 只部署 AgentStore (如果其他合约已部署)"
echo ""
read -p "请输入选项 (1-5): " choice

case $choice in
  1)
    echo "使用 BSC 官方 RPC 节点 1..."
    BSC_TESTNET_RPC="https://data-seed-prebsc-1-s1.binance.org:8545/" yarn deploy --network bscTestnet
    ;;
  2)
    echo "使用 BSC 官方 RPC 节点 2..."
    BSC_TESTNET_RPC="https://data-seed-prebsc-2-s1.binance.org:8545/" yarn deploy --network bscTestnet
    ;;
  3)
    echo "使用 BSC 官方 RPC 节点 3..."
    BSC_TESTNET_RPC="https://data-seed-prebsc-1-s2.binance.org:8545/" yarn deploy --network bscTestnet
    ;;
  4)
    echo "使用带重试机制的部署脚本..."
    yarn hardhat deploy --tags AgentStoreRetry --network bscTestnet
    ;;
  5)
    echo "只部署 AgentStore..."
    rm -f deployments/bscTestnet/AgentStore.json
    BSC_TESTNET_RPC="https://data-seed-prebsc-1-s1.binance.org:8545/" yarn deploy --network bscTestnet
    ;;
  *)
    echo "无效选项，使用默认 RPC..."
    yarn deploy --network bscTestnet
    ;;
esac
