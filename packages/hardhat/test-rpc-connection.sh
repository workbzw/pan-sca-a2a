#!/bin/bash

# 测试 BSC Testnet RPC 连接脚本

echo "🔍 测试 BSC Testnet RPC 节点连接..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 读取 Alchemy API Key
ALCHEMY_KEY="${ALCHEMY_API_KEY:-cR4WnXePioePZ5fFrnSiR}"

# RPC 节点列表
declare -a rpcs=(
  "https://bnb-testnet.g.alchemy.com/v2/${ALCHEMY_KEY}|Alchemy (推荐)"
  "https://data-seed-prebsc-1-s1.binance.org:8545/|BSC 官方节点 1"
  "https://data-seed-prebsc-2-s1.binance.org:8545/|BSC 官方节点 2"
  "https://data-seed-prebsc-1-s2.binance.org:8545/|BSC 官方节点 3"
  "https://bsc-testnet-rpc.publicnode.com|PublicNode"
  "https://bsc-testnet.public.blastapi.io|BlastAPI"
)

available_rpc=""
for rpc_info in "${rpcs[@]}"; do
  IFS='|' read -r rpc_url rpc_name <<< "$rpc_info"
  echo -n "测试 $rpc_name ($rpc_url) ... "
  
  response=$(timeout 10 curl -s -X POST "$rpc_url" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' 2>&1)
  
  if echo "$response" | grep -q '"result"'; then
    block_num=$(echo "$response" | grep -o '"result":"[^"]*"' | cut -d'"' -f4)
    block_dec=$(printf "%d" "$block_num" 2>/dev/null || echo "N/A")
    echo "✅ 可用 (区块: $block_dec)"
    if [ -z "$available_rpc" ]; then
      available_rpc="$rpc_url"
    fi
  else
    echo "❌ 不可用"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -n "$available_rpc" ]; then
  echo "✅ 找到可用的 RPC: $available_rpc"
  echo ""
  echo "使用此 RPC 部署:"
  echo "BSC_TESTNET_RPC=\"$available_rpc\" yarn deploy --network bscTestnet"
else
  echo "❌ 所有 RPC 节点都不可用"
  echo ""
  echo "可能的原因:"
  echo "1. 网络连接问题（防火墙、代理、DNS）"
  echo "2. 需要配置代理: export HTTP_PROXY=..."
  echo "3. 所有公共 RPC 节点暂时不可用"
  echo "4. 建议稍后重试或使用 VPN"
fi
