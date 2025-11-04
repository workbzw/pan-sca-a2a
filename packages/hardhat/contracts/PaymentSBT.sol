//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title PaymentSBT
 * @notice 支付发放SBT合约
 * @dev 接收付款后发放SBT，在SBT中记录付款信息，并将款项转账给目标地址
 */
contract PaymentSBT {
    // 付款信息结构
    struct PaymentInfo {
        uint256 amount;         // 付款金额（wei）
        address payer;          // 付款地址
        address recipient;      // 收款地址
        uint256 timestamp;      // 付款时间戳
        string description;     // 付款描述（可选）
    }

    // Token ID => 付款信息
    mapping(uint256 => PaymentInfo) public paymentInfo;
    
    // 用户地址 => Token ID数组
    mapping(address => uint256[]) public userTokens;
    
    // 收款地址 => 收到的付款Token IDs
    mapping(address => uint256[]) public recipientPayments;
    
    // Token总数
    uint256 private _tokenCounter;
    
    // Token拥有者映射
    mapping(uint256 => address) private _owners;
    
    // 用户拥有的Token数量
    mapping(address => uint256) private _balances;
    
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
        uint256 amount
    );

    /**
     * @notice 付款并发放SBT
     * @param recipient 收款地址
     * @param description 付款描述（可选，可为空字符串）
     * @return tokenId 新铸造的SBT Token ID
     */
    function makePayment(address recipient, string memory description) 
        public 
        payable 
        returns (uint256 tokenId) 
    {
        require(recipient != address(0), "PaymentSBT: Invalid recipient");
        require(msg.value > 0, "PaymentSBT: Payment amount must be greater than 0");
        
        // 增加Token计数器
        tokenId = ++_tokenCounter;
        
        // 记录付款信息
        paymentInfo[tokenId] = PaymentInfo({
            amount: msg.value,
            payer: msg.sender,
            recipient: recipient,
            timestamp: block.timestamp,
            description: description
        });
        
        // 分配Token给付款者
        _owners[tokenId] = msg.sender;
        _balances[msg.sender]++;
        userTokens[msg.sender].push(tokenId);
        recipientPayments[recipient].push(tokenId);
        
        // 转账给收款地址
        payable(recipient).transfer(msg.value);
        
        // 触发事件
        emit PaymentReceived(tokenId, msg.sender, recipient, msg.value, block.timestamp);
        emit SBTMinted(tokenId, msg.sender, recipient, msg.value);
        
        return tokenId;
    }

    /**
     * @notice 批量付款并发放SBT
     * @param recipients 收款地址数组
     * @param amounts 付款金额数组（wei）
     * @param descriptions 付款描述数组
     * @return tokenIds 新铸造的SBT Token ID数组
     */
    function makeBatchPayment(
        address[] memory recipients,
        uint256[] memory amounts,
        string[] memory descriptions
    ) 
        public 
        payable 
        returns (uint256[] memory tokenIds) 
    {
        require(recipients.length == amounts.length, "PaymentSBT: Arrays length mismatch");
        require(recipients.length == descriptions.length, "PaymentSBT: Descriptions length mismatch");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        require(msg.value >= totalAmount, "PaymentSBT: Insufficient payment");
        
        tokenIds = new uint256[](recipients.length);
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "PaymentSBT: Invalid recipient");
            require(amounts[i] > 0, "PaymentSBT: Amount must be greater than 0");
            
            // 增加Token计数器
            uint256 tokenId = ++_tokenCounter;
            tokenIds[i] = tokenId;
            
            // 记录付款信息
            paymentInfo[tokenId] = PaymentInfo({
                amount: amounts[i],
                payer: msg.sender,
                recipient: recipients[i],
                timestamp: block.timestamp,
                description: descriptions[i]
            });
            
            // 分配Token给付款者
            _owners[tokenId] = msg.sender;
            _balances[msg.sender]++;
            userTokens[msg.sender].push(tokenId);
            recipientPayments[recipients[i]].push(tokenId);
            
            // 转账给收款地址
            payable(recipients[i]).transfer(amounts[i]);
            
            // 触发事件
            emit PaymentReceived(tokenId, msg.sender, recipients[i], amounts[i], block.timestamp);
            emit SBTMinted(tokenId, msg.sender, recipients[i], amounts[i]);
        }
        
        // 如果有剩余资金，退还
        if (msg.value > totalAmount) {
            payable(msg.sender).transfer(msg.value - totalAmount);
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
     * @param owner 用户地址
     * @return Token ID数组
     */
    function getTokensByOwner(address owner) 
        public 
        view 
        returns (uint256[] memory) 
    {
        return userTokens[owner];
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
        address owner = _owners[tokenId];
        require(owner != address(0), "PaymentSBT: Token does not exist");
        return owner;
    }

    /**
     * @notice 获取用户拥有的Token数量
     * @param owner 用户地址
     * @return Token数量
     */
    function balanceOf(address owner) public view returns (uint256) {
        return _balances[owner];
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
}

