//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title PaymentSBT
 * @notice 支付发放SBT合约
 * @dev 接收付款后发放SBT，在SBT中记录付款信息，资金存储在合约中，可通过withdraw提取
 * @dev SBT具有随机稀有度系统，支持2种稀有度：Common（普通）和 Rare（稀有）
 * @dev 使用 OpenZeppelin Ownable, ReentrancyGuard 和 Address 库保证安全性
 */
contract PaymentSBT is Ownable, ReentrancyGuard {
    using Address for address payable;
    
    // 稀有度枚举
    enum Rarity {
        Common,  // 普通（70%概率）
        Rare     // 稀有（30%概率）
    }
    
    // 稀有度概率配置（以100为基数）
    uint256 public constant COMMON_PROBABILITY = 70;  // 70%
    uint256 public constant RARE_PROBABILITY = 30;    // 30%
    
    // 安全配置
    uint256 public constant MAX_BATCH_SIZE = 50;     // 批量支付最大数量，防止 Gas 耗尽
    
    // 付款信息结构
    struct PaymentInfo {
        uint256 amount;         // 付款金额（wei）
        address payer;          // 付款地址
        address recipient;      // 收款地址（合约地址）
        uint256 timestamp;      // 付款时间戳
        string description;     // 付款描述（可选）
        Rarity rarity;          // 稀有度
        string referrer;        // 推荐码（可选，可为空字符串）
    }

    // Token ID => 付款信息
    mapping(uint256 => PaymentInfo) public paymentInfo;
    
    // 用户地址 => Token ID数组
    mapping(address => uint256[]) public userTokens;
    
    // 收款地址 => 收到的付款Token IDs（现在都是合约地址）
    mapping(address => uint256[]) public recipientPayments;
    
    // Token总数
    uint256 private _tokenCounter;
    
    // Token拥有者映射
    mapping(uint256 => address) private _owners;
    
    // 用户拥有的Token数量
    mapping(address => uint256) private _balances;
    
    // Token ID => 稀有度
    mapping(uint256 => Rarity) public tokenRarity;
    
    // 稀有度 => Token ID数组
    mapping(Rarity => uint256[]) public tokensByRarity;
    
    // 用户地址 => 稀有度 => Token ID数组
    mapping(address => mapping(Rarity => uint256[])) public userTokensByRarity;
    
    // 推荐码 => 被推荐的Token ID数组
    mapping(string => uint256[]) public referrerTokens;
    
    // 所有推荐码列表
    string[] public referrerList;
    
    // 推荐码 => 是否已添加到列表
    mapping(string => bool) private referrerExists;
    
    // 事件
    event PaymentReceived(
        uint256 indexed tokenId,
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );
    
    event SBTMinted(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed recipient,
        uint256 amount,
        Rarity rarity
    );
    
    event Withdrawal(
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );
    
    // OwnershipTransferred 事件已由 OpenZeppelin Ownable 提供
    
    // 构造函数
    constructor() Ownable(msg.sender) {
    }
    
    /**
     * @notice 生成随机稀有度
     * @param seed 随机数种子
     * @return 稀有度
     * @dev 使用伪随机数生成，70%概率为Common，30%概率为Rare
     * @dev 当前使用链上伪随机数，未来可升级到 RedStone VRF 或 Chainlink VRF
     * @dev 升级方案：将 _generateRandomSeed 改为调用外部 VRF 合约
     */
    function _generateRarity(uint256 seed) private pure returns (Rarity) {
        uint256 random = seed % 100;
        if (random < COMMON_PROBABILITY) {
            return Rarity.Common;
        } else {
            return Rarity.Rare;
        }
    }
    
    /**
     * @notice 生成随机数种子
     * @param tokenId Token ID
     * @return 随机数种子
     * @dev 当前实现：使用链上伪随机数生成（成本约 $0.1-0.3/次，仅 Gas）
     * @dev 安全说明：
     *      - block.timestamp: 矿工可在一定范围内操控（±15秒）
     *      - block.prevrandao: 矿工可预测但无法完全控制
     *      - 对于SBT稀有度系统，攻击动机较低（无直接经济损失），当前实现已足够
     * 
     * @dev 未来升级方案：RedStone VRF（成本约 $0.01-0.05/次，最便宜）
     *      1. 添加 RedStone VRF 合约接口
     *      2. 将 _generateRandomSeed 改为调用 RedStone VRF
     *      3. 实现回调函数接收 VRF 结果
     *      4. 使用 requestId 映射到 tokenId
     * 
     * @dev 备选方案：Chainlink VRF（成本约 $0.6-1.3/次，最安全但较贵）
     */
    function _generateRandomSeed(uint256 tokenId) private view returns (uint256) {
        // TODO: 未来可升级到 RedStone VRF 以降低成本和提高安全性
        // 使用多个熵源增加随机性
        bytes32 blockHash = blockhash(block.number - 1);
        // 如果 blockhash 为 0（区块太旧），使用 block.number 作为替代
        if (blockHash == bytes32(0)) {
            blockHash = keccak256(abi.encodePacked(block.number));
        }
        
        return uint256(keccak256(abi.encodePacked(
            block.timestamp,        // 时间戳（矿工可部分操控）
            block.prevrandao,       // 随机数（矿工可预测）
            block.number,           // 区块号（增加熵）
            blockHash,              // 上一个区块哈希（增加熵，已处理 0 值情况）
            msg.sender,             // 调用者地址（用户可控，但增加多样性）
            address(this),          // 合约地址（固定但增加熵）
            tokenId,                // Token ID（可预测）
            _tokenCounter,          // 计数器（可预测）
            tx.origin,              // 交易发起者（增加熵）
            gasleft()               // 剩余gas（增加不可预测性）
        )));
    }
    
    // transferOwnership 已由 OpenZeppelin Ownable 提供，无需重复实现

    /**
     * @notice 付款并发放SBT
     * @param recipient 接收SBT的目标地址
     * @param description 付款描述（可选，可为空字符串）
     * @param referrer 推荐码（可选，可为空字符串）
     * @return tokenId 新铸造的SBT Token ID
     * @dev 资金存储在合约中，合约本身作为收款方，可通过withdraw提取
     * @dev SBT将发放给recipient地址，而不是付款者
     * @dev 使用 nonReentrant 防止重入攻击
     */
    function makePayment(address recipient, string memory description, string memory referrer) 
        public 
        payable 
        nonReentrant
        returns (uint256 tokenId) 
    {
        // 安全检查：确保支付金额大于 0
        require(msg.value > 0, "PaymentSBT: Payment amount must be greater than 0");
        
        // 安全检查：确保接收地址不为零地址
        require(recipient != address(0), "PaymentSBT: Recipient cannot be zero address");
        
        // 安全检查：防止 description 过长导致 Gas 耗尽（可选，根据需求调整）
        require(bytes(description).length <= 500, "PaymentSBT: Description too long");
        
        // 安全检查：防止 referrer 过长导致 Gas 耗尽
        require(bytes(referrer).length <= 100, "PaymentSBT: Referrer code too long");
        
        // 增加Token计数器
        tokenId = ++_tokenCounter;
        
        // 合约地址作为收款方
        address contractRecipient = address(this);
        
        // 生成随机稀有度
        uint256 randomSeed = _generateRandomSeed(tokenId);
        Rarity rarity = _generateRarity(randomSeed);
        
        // 记录付款信息
        paymentInfo[tokenId] = PaymentInfo({
            amount: msg.value,
            payer: msg.sender,
            recipient: contractRecipient,
            timestamp: block.timestamp,
            description: description,
            rarity: rarity,
            referrer: referrer
        });
        
        // 分配Token给指定的接收者（而不是付款者）
        _owners[tokenId] = recipient;
        _balances[recipient]++;
        userTokens[recipient].push(tokenId);
        recipientPayments[contractRecipient].push(tokenId);
        
        // 记录稀有度
        tokenRarity[tokenId] = rarity;
        tokensByRarity[rarity].push(tokenId);
        userTokensByRarity[recipient][rarity].push(tokenId);
        
        // 记录推荐关系（如果 referrer 不为空字符串）
        if (bytes(referrer).length > 0) {
            referrerTokens[referrer].push(tokenId);
            // 如果推荐码不在列表中，添加到列表
            if (!referrerExists[referrer]) {
                referrerList.push(referrer);
                referrerExists[referrer] = true;
            }
        }
        
        // 资金留在合约中，不立即转账
        
        // 触发事件
        emit PaymentReceived(tokenId, msg.sender, contractRecipient, msg.value, block.timestamp);
        emit SBTMinted(tokenId, recipient, contractRecipient, msg.value, rarity);
        
        return tokenId;
    }

    /**
     * @notice 批量付款并发放SBT
     * @param recipients 接收SBT的目标地址数组
     * @param amounts 付款金额数组（wei）
     * @param descriptions 付款描述数组
     * @param referrers 推荐码数组（可选，可为空字符串）
     * @return tokenIds 新铸造的SBT Token ID数组
     * @dev 所有资金存储在合约中，合约本身作为收款方
     * @dev SBT将发放给recipients数组中对应的地址
     * @dev 使用 nonReentrant 防止重入攻击
     */
    function makeBatchPayment(
        address[] memory recipients,
        uint256[] memory amounts,
        string[] memory descriptions,
        string[] memory referrers
    ) 
        public 
        payable 
        nonReentrant
        returns (uint256[] memory tokenIds) 
    {
        // 安全检查：防止数组长度不匹配
        require(
            recipients.length == amounts.length && 
            amounts.length == descriptions.length && 
            descriptions.length == referrers.length,
            "PaymentSBT: Arrays length mismatch"
        );
        
        // 安全检查：限制批量大小，防止 Gas 耗尽攻击
        require(amounts.length > 0 && amounts.length <= MAX_BATCH_SIZE, "PaymentSBT: Invalid batch size");
        
        // 安全检查：防止整数溢出（Solidity 0.8+ 自动检查，但显式验证更安全）
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "PaymentSBT: Amount must be greater than 0");
            require(recipients[i] != address(0), "PaymentSBT: Recipient cannot be zero address");
            require(bytes(referrers[i]).length <= 100, "PaymentSBT: Referrer code too long");
            totalAmount += amounts[i];
            // 防止溢出（虽然 Solidity 0.8+ 会自动 revert）
            require(totalAmount >= amounts[i], "PaymentSBT: Overflow detected");
        }
        require(msg.value >= totalAmount, "PaymentSBT: Insufficient payment");
        
        tokenIds = new uint256[](amounts.length);
        address contractRecipient = address(this);
        
        for (uint256 i = 0; i < amounts.length; i++) {
            // amounts[i] > 0 和 recipients[i] != address(0) 已在上面验证，这里不需要重复检查
            
            // 增加Token计数器
            uint256 tokenId = ++_tokenCounter;
            tokenIds[i] = tokenId;
            
            // 生成随机稀有度
            uint256 randomSeed = _generateRandomSeed(tokenId);
            Rarity rarity = _generateRarity(randomSeed);
            
            // 记录付款信息
            paymentInfo[tokenId] = PaymentInfo({
                amount: amounts[i],
                payer: msg.sender,
                recipient: contractRecipient,
                timestamp: block.timestamp,
                description: descriptions[i],
                rarity: rarity,
                referrer: referrers[i]
            });
            
            // 分配Token给指定的接收者（而不是付款者）
            _owners[tokenId] = recipients[i];
            _balances[recipients[i]]++;
            userTokens[recipients[i]].push(tokenId);
            recipientPayments[contractRecipient].push(tokenId);
            
            // 记录稀有度
            tokenRarity[tokenId] = rarity;
            tokensByRarity[rarity].push(tokenId);
            userTokensByRarity[recipients[i]][rarity].push(tokenId);
            
            // 记录推荐关系（如果 referrer 不为空字符串）
            if (bytes(referrers[i]).length > 0) {
                referrerTokens[referrers[i]].push(tokenId);
                // 如果推荐码不在列表中，添加到列表
                if (!referrerExists[referrers[i]]) {
                    referrerList.push(referrers[i]);
                    referrerExists[referrers[i]] = true;
                }
            }
            
            // 资金留在合约中，不立即转账
            
            // 触发事件
            emit PaymentReceived(tokenId, msg.sender, contractRecipient, amounts[i], block.timestamp);
            emit SBTMinted(tokenId, recipients[i], contractRecipient, amounts[i], rarity);
        }
        
        // 如果有剩余资金，安全退还（使用 Address.sendValue，更安全）
        if (msg.value > totalAmount) {
            uint256 refundAmount = msg.value - totalAmount;
            Address.sendValue(payable(msg.sender), refundAmount);
        }
        
        return tokenIds;
    }

    /**
     * @notice 获取Token的付款信息
     * @param tokenId Token ID
     * @return 付款信息
     */
    function getPaymentInfo(uint256 tokenId) 
        public 
        view 
        returns (PaymentInfo memory) 
    {
        require(_owners[tokenId] != address(0), "PaymentSBT: Token does not exist");
        return paymentInfo[tokenId];
    }

    /**
     * @notice 获取用户拥有的所有Token IDs
     * @param user 用户地址
     * @return Token ID数组
     */
    function getTokensByOwner(address user) 
        public 
        view 
        returns (uint256[] memory) 
    {
        return userTokens[user];
    }
    
    /**
     * @notice 获取用户拥有的所有SBT的完整信息
     * @param user 用户地址
     * @return tokenIds Token ID数组
     * @return paymentInfos 付款信息数组
     */
    function getSBTsByAddress(address user) 
        public 
        view 
        returns (uint256[] memory tokenIds, PaymentInfo[] memory paymentInfos) 
    {
        uint256[] memory tokens = userTokens[user];
        uint256 count = tokens.length;
        
        tokenIds = new uint256[](count);
        paymentInfos = new PaymentInfo[](count);
        
        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = tokens[i];
            tokenIds[i] = tokenId;
            paymentInfos[i] = paymentInfo[tokenId];
        }
        
        return (tokenIds, paymentInfos);
    }

    /**
     * @notice 获取收款地址收到的所有付款Token IDs
     * @param recipient 收款地址
     * @return Token ID数组
     */
    function getPaymentsByRecipient(address recipient) 
        public 
        view 
        returns (uint256[] memory) 
    {
        return recipientPayments[recipient];
    }

    /**
     * @notice 获取Token的拥有者
     * @param tokenId Token ID
     * @return 拥有者地址
     */
    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "PaymentSBT: Token does not exist");
        return tokenOwner;
    }

    /**
     * @notice 获取用户拥有的Token数量
     * @param user 用户地址
     * @return Token数量
     */
    function balanceOf(address user) public view returns (uint256) {
        return _balances[user];
    }

    /**
     * @notice 获取总Token数量
     * @return 总Token数量
     */
    function totalSupply() public view returns (uint256) {
        return _tokenCounter;
    }

    /**
     * @notice 检查Token是否存在
     * @param tokenId Token ID
     * @return 是否存在
     */
    function exists(uint256 tokenId) public view returns (bool) {
        return _owners[tokenId] != address(0);
    }
    
    /**
     * @notice 提取合约中的资金
     * @param to 提取目标地址
     * @param amount 提取金额（wei），如果为0则提取全部
     * @dev 使用 onlyOwner 和 nonReentrant 保证安全性
     * @dev 使用 Address.sendValue 安全转账
     */
    function withdraw(address payable to, uint256 amount) 
        public 
        onlyOwner 
        nonReentrant 
    {
        // 安全检查：验证接收地址
        require(to != address(0), "PaymentSBT: Invalid recipient address");
        require(address(this).balance > 0, "PaymentSBT: No funds to withdraw");
        
        // 计算提取金额
        uint256 withdrawAmount = amount;
        if (amount == 0) {
            // 如果amount为0，提取全部余额
            withdrawAmount = address(this).balance;
        } else {
            require(amount <= address(this).balance, "PaymentSBT: Insufficient contract balance");
        }
        
        // 使用 Address.sendValue 安全转账
        Address.sendValue(to, withdrawAmount);
        
        emit Withdrawal(to, withdrawAmount, block.timestamp);
    }
    
    /**
     * @notice 获取合约余额
     * @return 合约余额（wei）
     */
    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @notice 获取Token的稀有度
     * @param tokenId Token ID
     * @return 稀有度
     */
    function getRarity(uint256 tokenId) public view returns (Rarity) {
        require(_owners[tokenId] != address(0), "PaymentSBT: Token does not exist");
        return tokenRarity[tokenId];
    }
    
    /**
     * @notice 获取指定稀有度的所有Token IDs
     * @param rarity 稀有度
     * @return Token ID数组
     */
    function getTokensByRarity(Rarity rarity) public view returns (uint256[] memory) {
        return tokensByRarity[rarity];
    }
    
    /**
     * @notice 获取用户拥有的指定稀有度的Token IDs
     * @param user 用户地址
     * @param rarity 稀有度
     * @return Token ID数组
     */
    function getTokensByOwnerAndRarity(address user, Rarity rarity) 
        public 
        view 
        returns (uint256[] memory) 
    {
        return userTokensByRarity[user][rarity];
    }
    
    /**
     * @notice 获取指定稀有度的Token数量
     * @param rarity 稀有度
     * @return Token数量
     */
    function getRarityCount(Rarity rarity) public view returns (uint256) {
        return tokensByRarity[rarity].length;
    }
    
    /**
     * @notice 获取用户拥有的指定稀有度的Token数量
     * @param user 用户地址
     * @param rarity 稀有度
     * @return Token数量
     */
    function getRarityCountByOwner(address user, Rarity rarity) public view returns (uint256) {
        return userTokensByRarity[user][rarity].length;
    }
    
    /**
     * @notice 获取用户拥有的所有类别SBT的数量统计
     * @param user 用户地址
     * @return commonCount Common类别的数量
     * @return rareCount Rare类别的数量
     * @return totalCount 总数量
     * @dev 一次性返回所有类别的统计，比分别调用更高效
     */
    function getRarityStatsByOwner(address user) 
        public 
        view 
        returns (uint256 commonCount, uint256 rareCount, uint256 totalCount) 
    {
        commonCount = userTokensByRarity[user][Rarity.Common].length;
        rareCount = userTokensByRarity[user][Rarity.Rare].length;
        totalCount = commonCount + rareCount;
        return (commonCount, rareCount, totalCount);
    }
    
    /**
     * @notice 获取推荐码推荐的所有Token IDs
     * @param referrer 推荐码
     * @return Token ID数组
     */
    function getTokensByReferrer(string memory referrer) 
        public 
        view 
        returns (uint256[] memory) 
    {
        return referrerTokens[referrer];
    }
    
    /**
     * @notice 获取推荐码推荐的Token数量
     * @param referrer 推荐码
     * @return Token数量
     */
    function getReferrerCount(string memory referrer) 
        public 
        view 
        returns (uint256) 
    {
        return referrerTokens[referrer].length;
    }
    
    /**
     * @notice 获取所有推荐码列表
     * @return 推荐码数组
     * @dev 返回所有曾经使用的推荐码列表
     */
    function getAllReferrers() 
        public 
        view 
        returns (string[] memory) 
    {
        return referrerList;
    }
    
    /**
     * @notice 获取推荐码总数
     * @return 推荐码数量
     */
    function getReferrerListLength() 
        public 
        view 
        returns (uint256) 
    {
        return referrerList.length;
    }
    
    /**
     * @notice 获取推荐码统计信息（推荐码和推荐数量）
     * @return referrers 推荐码数组
     * @return counts 每个推荐码推荐的Token数量数组
     * @dev 一次性返回所有推荐码和推荐数量，方便前端展示
     */
    function getReferrerStats() 
        public 
        view 
        returns (string[] memory referrers, uint256[] memory counts) 
    {
        uint256 length = referrerList.length;
        referrers = new string[](length);
        counts = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            referrers[i] = referrerList[i];
            counts[i] = referrerTokens[referrerList[i]].length;
        }
        
        return (referrers, counts);
    }
    
    /**
     * @notice 接收ETH（fallback函数）
     */
    receive() external payable {
        // 允许合约接收ETH
    }
}

