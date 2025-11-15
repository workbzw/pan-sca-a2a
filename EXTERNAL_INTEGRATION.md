# PaymentSBT 合约外部调用指南

## 合约信息

- **合约地址（BSC Testnet）**: `0xa7C4AAFBD6eE0884A6B8ADF4500F05051f7136fe`
- **网络**: BSC Testnet (Chain ID: 97)
- **RPC URL**: `https://data-seed-prebsc-1-s1.binance.org:8545/`

## 主要函数

### 1. makePayment - 付款并铸造 SBT

```solidity
function makePayment(address recipient, string memory description, string memory referrer) 
    public 
    payable 
    returns (uint256 tokenId)
```

**参数说明：**
- `recipient`: 接收 SBT 的目标地址（不能为零地址）
- `description`: 付款描述（可选，可为空字符串，最大长度 500 字符）
- `referrer`: 推荐码（可选，可为空字符串，最大长度 100 字符）

**注意：** SBT 将发放给 `recipient` 地址，而不是付款者（`msg.sender`）。资金存储在合约中，合约本身作为收款方。推荐码可以是任何字符串标识符（如 "REF123"、"USER001" 等）。

### 2. makeBatchPayment - 批量付款并铸造 SBT

```solidity
function makeBatchPayment(
    address[] memory recipients,
    uint256[] memory amounts,
    string[] memory descriptions,
    string[] memory referrers
) 
    public 
    payable 
    returns (uint256[] memory tokenIds)
```

**参数说明：**
- `recipients`: 接收 SBT 的目标地址数组（不能包含零地址）
- `amounts`: 付款金额数组（wei）
- `descriptions`: 付款描述数组（每个描述最大长度 500 字符）
- `referrers`: 推荐码数组（每个推荐码最大长度 100 字符，可为空字符串）

**注意：** 四个数组的长度必须一致，批量大小限制为 50（`MAX_BATCH_SIZE`）。

### 3. 查询函数

- `getPaymentInfo(uint256 tokenId)` - 获取付款信息（包含推荐码）
- `getTokensByOwner(address owner)` - 获取用户的所有 SBT Token IDs
- `getSBTsByAddress(address owner)` - 获取用户的所有 SBT 完整信息（包含推荐码）
- `getRarity(uint256 tokenId)` - 获取 SBT 的稀有度
- `getContractBalance()` - 获取合约余额

### 4. 推荐码查询函数

- `getTokensByReferrer(string memory referrer)` - 获取推荐码推荐的所有 Token IDs
- `getReferrerCount(string memory referrer)` - 获取推荐码的推荐数量
- `getAllReferrers()` - 获取所有推荐码列表
- `getReferrerListLength()` - 获取推荐码总数
- `getReferrerStats()` - 获取推荐码统计信息（推荐码数组 + 推荐数量数组）

---

## 使用 ethers.js 调用

### 安装依赖

```bash
npm install ethers
```

### 示例代码

```typescript
import { ethers } from 'ethers';

// 合约地址和 ABI
const PAYMENT_SBT_ADDRESS = '0xa7C4AAFBD6eE0884A6B8ADF4500F05051f7136fe';

// 简化的 ABI（只包含需要的函数）
const PAYMENT_SBT_ABI = [
  "function makePayment(address recipient, string memory description, string memory referrer) public payable returns (uint256)",
  "function makeBatchPayment(address[] memory recipients, uint256[] memory amounts, string[] memory descriptions, string[] memory referrers) public payable returns (uint256[] memory)",
  "function getPaymentInfo(uint256 tokenId) public view returns (tuple(uint256 amount, address payer, address recipient, uint256 timestamp, string description, uint8 rarity, string referrer))",
  "function getTokensByReferrer(string memory referrer) public view returns (uint256[] memory)",
  "function getReferrerCount(string memory referrer) public view returns (uint256)",
  "function getAllReferrers() public view returns (string[] memory)",
  "function getReferrerStats() public view returns (string[] memory referrers, uint256[] memory counts)",
  "function getTokensByOwner(address owner) public view returns (uint256[])",
  "function getSBTsByAddress(address owner) public view returns (uint256[] memory tokenIds, tuple(uint256 amount, address payer, address recipient, uint256 timestamp, string description, uint8 rarity)[] memory paymentInfos)",
  "function getRarity(uint256 tokenId) public view returns (uint8)",
  "function getContractBalance() public view returns (uint256)",
  "event SBTMinted(uint256 indexed tokenId, address indexed owner, address indexed recipient, uint256 amount, uint8 rarity)"
];

// 连接网络
const provider = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545/');

// 使用私钥创建钱包（或使用 MetaMask 等）
const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

// 创建合约实例
const paymentSBT = new ethers.Contract(
  PAYMENT_SBT_ADDRESS,
  PAYMENT_SBT_ABI,
  wallet
);

// 1. 调用 makePayment（付款并铸造 SBT）
async function makePayment(recipient: string, description: string, referrer: string, amountInEth: string) {
  try {
    const amount = ethers.parseEther(amountInEth); // 转换为 wei
    
    const tx = await paymentSBT.makePayment(recipient, description, referrer, {
      value: amount
    });
    
    console.log('交易已发送:', tx.hash);
    
    // 等待交易确认
    const receipt = await tx.wait();
    console.log('交易已确认:', receipt);
    
    // 从事件中获取 tokenId
    const mintEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = paymentSBT.interface.parseLog(log);
        return parsed?.name === 'SBTMinted';
      } catch {
        return false;
      }
    });
    
    if (mintEvent) {
      const parsed = paymentSBT.interface.parseLog(mintEvent);
      const tokenId = parsed?.args[0];
      const rarity = parsed?.args[4]; // 0 = Common, 1 = Rare
      console.log('SBT Token ID:', tokenId.toString());
      console.log('稀有度:', rarity === 0 ? 'Common' : 'Rare');
      return { tokenId, rarity };
    }
  } catch (error) {
    console.error('付款失败:', error);
    throw error;
  }
}

// 2. 查询用户的 SBT
async function getUserSBTs(userAddress: string) {
  try {
    const tokenIds = await paymentSBT.getTokensByOwner(userAddress);
    console.log('用户 SBT Token IDs:', tokenIds.map((id: bigint) => id.toString()));
    return tokenIds;
  } catch (error) {
    console.error('查询失败:', error);
    throw error;
  }
}

// 3. 获取 SBT 完整信息
async function getSBTInfo(tokenId: bigint) {
  try {
    const info = await paymentSBT.getPaymentInfo(tokenId);
    console.log('SBT 信息:', {
      amount: ethers.formatEther(info.amount),
      payer: info.payer,
      recipient: info.recipient,
      timestamp: new Date(Number(info.timestamp) * 1000),
      description: info.description,
      rarity: info.rarity === 0 ? 'Common' : 'Rare'
    });
    return info;
  } catch (error) {
    console.error('查询失败:', error);
    throw error;
  }
}

// 4. 获取用户所有 SBT 的完整信息
async function getUserSBTsFullInfo(userAddress: string) {
  try {
    const [tokenIds, paymentInfos] = await paymentSBT.getSBTsByAddress(userAddress);
    
    const sbtList = tokenIds.map((tokenId: bigint, index: number) => ({
      tokenId: tokenId.toString(),
      amount: ethers.formatEther(paymentInfos[index].amount),
      payer: paymentInfos[index].payer,
      recipient: paymentInfos[index].recipient,
      timestamp: new Date(Number(paymentInfos[index].timestamp) * 1000),
      description: paymentInfos[index].description,
      rarity: paymentInfos[index].rarity === 0 ? 'Common' : 'Rare'
    }));
    
    console.log('用户所有 SBT:', sbtList);
    return sbtList;
  } catch (error) {
    console.error('查询失败:', error);
    throw error;
  }
}

// 使用示例
async function main() {
  // 付款并铸造 SBT（SBT 将发放给指定的 recipient 地址）
  const recipient = wallet.address; // 或任何其他地址
  const referrer = "REF123"; // 推荐码（可选，可为空字符串）
  const result = await makePayment(recipient, 'Payment for Agent: Test Agent', referrer, '0.001');
  
  // 查询用户的 SBT
  const userSBTs = await getUserSBTs(wallet.address);
  
  // 获取 SBT 信息
  if (result.tokenId) {
    await getSBTInfo(result.tokenId);
  }
  
  // 获取用户所有 SBT 完整信息
  await getUserSBTsFullInfo(wallet.address);
}

main().catch(console.error);
```

---

## 使用 viem 调用

### 安装依赖

```bash
npm install viem
```

### 示例代码

```typescript
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// 合约地址
const PAYMENT_SBT_ADDRESS = '0xa7C4AAFBD6eE0884A6B8ADF4500F05051f7136fe' as const;

// 简化的 ABI
const PAYMENT_SBT_ABI = [
  {
    name: 'makePayment',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'description', type: 'string' },
      { name: 'referrer', type: 'string' }
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'makeBatchPayment',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
      { name: 'descriptions', type: 'string[]' },
      { name: 'referrers', type: 'string[]' }
    ],
    outputs: [{ name: 'tokenIds', type: 'uint256[]' }],
  },
  {
    name: 'getPaymentInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'amount', type: 'uint256' },
        { name: 'payer', type: 'address' },
        { name: 'recipient', type: 'address' },
        { name: 'timestamp', type: 'uint256' },
        { name: 'description', type: 'string' },
        { name: 'rarity', type: 'uint8' },
      ]
    }],
  },
  {
    name: 'getTokensByOwner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'getSBTsByAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [
      { name: 'tokenIds', type: 'uint256[]' },
      { name: 'paymentInfos', type: 'tuple[]' },
    ],
  },
  {
    name: 'SBTMinted',
    type: 'event',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256' },
      { name: 'rarity', type: 'uint8' },
    ],
  },
] as const;

// 创建账户
const account = privateKeyToAccount('0xYOUR_PRIVATE_KEY');

// 创建客户端
const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/'),
});

const walletClient = createWalletClient({
  account,
  chain: bscTestnet,
  transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/'),
});

// 1. 调用 makePayment
async function makePayment(recipient: `0x${string}`, description: string, referrer: string, amountInEth: string) {
  try {
    const hash = await walletClient.writeContract({
      address: PAYMENT_SBT_ADDRESS,
      abi: PAYMENT_SBT_ABI,
      functionName: 'makePayment',
      args: [recipient, description, referrer],
      value: parseEther(amountInEth),
    });
    
    console.log('交易已发送:', hash);
    
    // 等待交易确认
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('交易已确认:', receipt);
    
    // 从事件中获取 tokenId
    const logs = receipt.logs;
    for (const log of logs) {
      try {
        const decoded = publicClient.decodeEventLog({
          abi: PAYMENT_SBT_ABI,
          data: log.data,
          topics: log.topics,
        });
        
        if (decoded.eventName === 'SBTMinted') {
          const tokenId = decoded.args.tokenId;
          const rarity = decoded.args.rarity;
          console.log('SBT Token ID:', tokenId.toString());
          console.log('稀有度:', rarity === 0 ? 'Common' : 'Rare');
          return { tokenId, rarity };
        }
      } catch (e) {
        // 不是我们要找的事件
      }
    }
  } catch (error) {
    console.error('付款失败:', error);
    throw error;
  }
}

// 2. 查询用户的 SBT
async function getUserSBTs(userAddress: `0x${string}`) {
  try {
    const tokenIds = await publicClient.readContract({
      address: PAYMENT_SBT_ADDRESS,
      abi: PAYMENT_SBT_ABI,
      functionName: 'getTokensByOwner',
      args: [userAddress],
    });
    
    console.log('用户 SBT Token IDs:', tokenIds.map(id => id.toString()));
    return tokenIds;
  } catch (error) {
    console.error('查询失败:', error);
    throw error;
  }
}

// 3. 获取 SBT 完整信息
async function getSBTInfo(tokenId: bigint) {
  try {
    const info = await publicClient.readContract({
      address: PAYMENT_SBT_ADDRESS,
      abi: PAYMENT_SBT_ABI,
      functionName: 'getPaymentInfo',
      args: [tokenId],
    });
    
    console.log('SBT 信息:', {
      amount: formatEther(info.amount),
      payer: info.payer,
      recipient: info.recipient,
      timestamp: new Date(Number(info.timestamp) * 1000),
      description: info.description,
      rarity: info.rarity === 0 ? 'Common' : 'Rare',
    });
    
    return info;
  } catch (error) {
    console.error('查询失败:', error);
    throw error;
  }
}

// 使用示例
async function main() {
  const userAddress = account.address;
  
  // 付款并铸造 SBT（SBT 将发放给指定的 recipient 地址）
  const recipient = userAddress; // 或任何其他地址
  const referrer = "REF123"; // 推荐码（可选，可为空字符串）
  const result = await makePayment(recipient, 'Payment for Agent: Test Agent', referrer, '0.001');
  
  // 查询用户的 SBT
  await getUserSBTs(userAddress);
  
  // 获取 SBT 信息
  if (result?.tokenId) {
    await getSBTInfo(result.tokenId);
  }
}

main().catch(console.error);
```

---

## 使用 Web3.js 调用

### 安装依赖

```bash
npm install web3
```

### 示例代码

```typescript
import Web3 from 'web3';

const web3 = new Web3('https://data-seed-prebsc-1-s1.binance.org:8545/');

const PAYMENT_SBT_ADDRESS = '0xa7C4AAFBD6eE0884A6B8ADF4500F05051f7136fe';

// ABI（简化版）
const PAYMENT_SBT_ABI = [
  {
    name: 'makePayment',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'description', type: 'string' },
      { name: 'referrer', type: 'string' }
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  // ... 其他函数
];

const contract = new web3.eth.Contract(PAYMENT_SBT_ABI, PAYMENT_SBT_ADDRESS);

// 使用账户
const account = web3.eth.accounts.privateKeyToAccount('0xYOUR_PRIVATE_KEY');
web3.eth.accounts.wallet.add(account);

// 调用 makePayment
async function makePayment(recipient: string, description: string, referrer: string, amountInEth: string) {
  try {
    const result = await contract.methods
      .makePayment(recipient, description, referrer)
      .send({
        from: account.address,
        value: web3.utils.toWei(amountInEth, 'ether'),
        gas: 200000,
      });
    
    console.log('交易哈希:', result.transactionHash);
    
    // 从事件中获取 tokenId
    const mintEvent = result.events?.SBTMinted;
    if (mintEvent) {
      const tokenId = mintEvent.returnValues.tokenId;
      const rarity = mintEvent.returnValues.rarity;
      console.log('SBT Token ID:', tokenId);
      console.log('稀有度:', rarity === '0' ? 'Common' : 'Rare');
      return { tokenId, rarity };
    }
  } catch (error) {
    console.error('付款失败:', error);
    throw error;
  }
}

// 查询函数
async function getUserSBTs(userAddress: string) {
  try {
    const tokenIds = await contract.methods.getTokensByOwner(userAddress).call();
    return tokenIds;
  } catch (error) {
    console.error('查询失败:', error);
    throw error;
  }
}
```

---

## 稀有度枚举

- `0` = `Common`（普通，70% 概率）
- `1` = `Rare`（稀有，30% 概率）

## 注意事项

1. **网络**: 确保连接到 BSC Testnet（Chain ID: 97）
2. **Gas**: 建议设置足够的 Gas Limit（约 200,000-300,000）
3. **事件监听**: 可以通过监听 `SBTMinted` 事件获取新铸造的 SBT 信息
4. **错误处理**: 建议添加完整的错误处理逻辑

## 完整 ABI

完整的合约 ABI 可以在 `packages/nextjs/contracts/deployedContracts.ts` 中找到。

