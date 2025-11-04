//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./EIP8004/IdentityRegistry.sol";
import "./EIP8004/ReputationRegistry.sol";
import "./EIP8004/ValidationRegistry.sol";

/**
 * @title AgentStore
 * @notice Agent 商店主合约，集成 EIP-8004 功能
 * @dev 提供完整的 Agent 注册、发现、评价和管理功能
 */
contract AgentStore {
    IdentityRegistry public identityRegistry;
    ReputationRegistry public reputationRegistry;
    ValidationRegistry public validationRegistry;

    // 请求方式枚举
    enum RequestMethod {
        GET,
        POST,
        PUT,
        DELETE
    }

    struct AgentListing {
        uint256 agentId;           // Agent ID
        string name;               // Agent 名称
        string description;        // 简介
        string link;               // 链接
        RequestMethod method;       // 请求方式
        string requestParams;      // 请求参数（JSON 字符串）
        uint256 price;             // 价格（以 wei 为单位）
        address owner;             // 所有者
        bool listed;               // 是否上架
        uint256 listedAt;          // 上架时间
        uint256 usageCount;        // 使用次数
    }

    // Agent ID => Listing
    mapping(uint256 => AgentListing) public listings;
    
    
    // 所有上架的 Agent IDs
    uint256[] public allListedAgents;
    
    // 搜索关键词 => Agent IDs（简化版，实际可用链下索引）
    mapping(string => uint256[]) public searchIndex;

    // 事件
    event AgentListed(
        uint256 indexed agentId,
        string name,
        address indexed owner,
        uint256 price,
        uint256 timestamp
    );
    
    event AgentUnlisted(
        uint256 indexed agentId,
        address indexed owner
    );
    
    event AgentUsed(
        uint256 indexed agentId,
        address indexed user,
        uint256 timestamp
    );

    constructor(
        address _identityRegistry,
        address _reputationRegistry,
        address _validationRegistry
    ) {
        identityRegistry = IdentityRegistry(_identityRegistry);
        reputationRegistry = ReputationRegistry(_reputationRegistry);
        validationRegistry = ValidationRegistry(_validationRegistry);
    }

    /**
     * @notice 注册并上架 Agent
     * @param name Agent 名称
     * @param description 简介
     * @param link 链接
     * @param method 请求方式
     * @param requestParams 请求参数（JSON 字符串）
     * @param price 价格（以 wei 为单位）
     * @return agentId 新创建的 Agent ID
     */
    function registerAndListAgent(
        string memory name,
        string memory description,
        string memory link,
        RequestMethod method,
        string memory requestParams,
        uint256 price
    ) public returns (uint256 agentId) {
        // 注册身份（使用链接作为 metadataURI）
        agentId = identityRegistry.registerAgent(link);
        
        // 创建上架信息
        listings[agentId] = AgentListing({
            agentId: agentId,
            name: name,
            description: description,
            link: link,
            method: method,
            requestParams: requestParams,
            price: price,
            owner: msg.sender,
            listed: true,
            listedAt: block.timestamp,
            usageCount: 0
        });
        
        allListedAgents.push(agentId);
        
        emit AgentListed(agentId, name, msg.sender, price, block.timestamp);
        
        return agentId;
    }

    /**
     * @notice 更新 Agent 信息
     * @param agentId Agent ID
     * @param name Agent 名称
     * @param description 简介
     * @param link 链接
     * @param method 请求方式
     * @param requestParams 请求参数
     * @param price 价格
     */
    function updateAgent(
        uint256 agentId,
        string memory name,
        string memory description,
        string memory link,
        RequestMethod method,
        string memory requestParams,
        uint256 price
    ) public {
        require(listings[agentId].owner == msg.sender, "AgentStore: Not owner");
        require(listings[agentId].listed, "AgentStore: Not listed");
        
        listings[agentId].name = name;
        listings[agentId].description = description;
        listings[agentId].link = link;
        listings[agentId].method = method;
        listings[agentId].requestParams = requestParams;
        listings[agentId].price = price;
    }

    /**
     * @notice 下架 Agent
     * @param agentId Agent ID
     */
    function unlistAgent(uint256 agentId) public {
        require(listings[agentId].owner == msg.sender, "AgentStore: Not owner");
        require(listings[agentId].listed, "AgentStore: Not listed");
        
        listings[agentId].listed = false;
        
        emit AgentUnlisted(agentId, msg.sender);
    }

    /**
     * @notice 记录 Agent 使用
     * @param agentId Agent ID
     */
    function recordUsage(uint256 agentId) public {
        require(listings[agentId].listed, "AgentStore: Agent not listed");
        listings[agentId].usageCount += 1;
        emit AgentUsed(agentId, msg.sender, block.timestamp);
    }

    /**
     * @notice 提交评价
     * @param agentId Agent ID
     * @param rating 评分 (1-5)
     * @param comment 评价内容
     */
    function submitRating(
        uint256 agentId,
        uint8 rating,
        string memory comment
    ) public {
        reputationRegistry.submitFeedback(agentId, rating, comment);
    }

    /**
     * @notice 获取所有上架的 Agents
     * @return agentIds Agent ID 数组
     */
    function getAllListedAgents() public view returns (uint256[] memory agentIds) {
        return allListedAgents;
    }

    /**
     * @notice 调用 Agent（支付费用并记录使用）
     * @param agentId Agent ID
     */
    function callAgent(uint256 agentId) public payable {
        AgentListing storage listing = listings[agentId];
        require(listing.listed, "AgentStore: Agent not listed");
        require(msg.value >= listing.price, "AgentStore: Insufficient payment");
        
        // 如果支付超过价格，退还多余部分
        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }
        
        // 将费用转给所有者
        payable(listing.owner).transfer(listing.price);
        
        // 记录使用
        listing.usageCount += 1;
        
        emit AgentUsed(agentId, msg.sender, block.timestamp);
    }

    /**
     * @notice 获取 Agent 完整信息
     * @param agentId Agent ID
     * @return listing 上架信息
     * @return identity 身份信息
     * @return averageRating 平均评分（放大 1000 倍）
     * @return feedbackCount 反馈数量
     */
    function getAgentFullInfo(uint256 agentId) public view returns (
        AgentListing memory listing,
        IdentityRegistry.AgentIdentity memory identity,
        uint256 averageRating,
        uint256 feedbackCount
    ) {
        listing = listings[agentId];
        identity = identityRegistry.getAgentIdentity(agentId);
        (, uint256 avgRating, uint256 count) = reputationRegistry.getReputation(agentId);
        averageRating = avgRating;
        feedbackCount = count;
    }
}

