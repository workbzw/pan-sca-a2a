//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title IdentityRegistry
 * @notice EIP-8004 身份注册表
 * @dev 为每个 Agent 提供唯一的链上身份标识
 */
contract IdentityRegistry {
    struct AgentIdentity {
        address owner;           // Agent 所有者地址
        string metadataURI;      // IPFS 元数据 URI
        uint256 createdAt;        // 创建时间戳
        bool active;             // 是否激活
    }

    // Agent ID => Agent Identity
    mapping(uint256 => AgentIdentity) public identities;
    
    // Owner => Agent IDs
    mapping(address => uint256[]) public ownerAgents;
    
    // 下一个 Agent ID
    uint256 private nextAgentId = 1;
    
    // 事件
    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        string metadataURI,
        uint256 timestamp
    );
    
    event AgentUpdated(
        uint256 indexed agentId,
        address indexed owner,
        string newMetadataURI
    );
    
    event AgentDeactivated(
        uint256 indexed agentId,
        address indexed owner
    );

    /**
     * @notice 注册新的 Agent 身份
     * @param metadataURI IPFS 元数据 URI
     * @return agentId 新创建的 Agent ID
     */
    function registerAgent(string memory metadataURI) public returns (uint256 agentId) {
        agentId = nextAgentId++;
        
        identities[agentId] = AgentIdentity({
            owner: msg.sender,
            metadataURI: metadataURI,
            createdAt: block.timestamp,
            active: true
        });
        
        ownerAgents[msg.sender].push(agentId);
        
        emit AgentRegistered(agentId, msg.sender, metadataURI, block.timestamp);
        
        return agentId;
    }

    /**
     * @notice 更新 Agent 元数据
     * @param agentId Agent ID
     * @param newMetadataURI 新的元数据 URI
     */
    function updateAgentMetadata(uint256 agentId, string memory newMetadataURI) public {
        require(identities[agentId].owner == msg.sender, "IdentityRegistry: Not owner");
        require(identities[agentId].active, "IdentityRegistry: Agent inactive");
        
        identities[agentId].metadataURI = newMetadataURI;
        
        emit AgentUpdated(agentId, msg.sender, newMetadataURI);
    }

    /**
     * @notice 停用 Agent
     * @param agentId Agent ID
     */
    function deactivateAgent(uint256 agentId) public {
        require(identities[agentId].owner == msg.sender, "IdentityRegistry: Not owner");
        require(identities[agentId].active, "IdentityRegistry: Already inactive");
        
        identities[agentId].active = false;
        
        emit AgentDeactivated(agentId, msg.sender);
    }

    /**
     * @notice 获取 Agent 身份信息
     * @param agentId Agent ID
     * @return identity Agent 身份结构
     */
    function getAgentIdentity(uint256 agentId) public view returns (AgentIdentity memory identity) {
        return identities[agentId];
    }

    /**
     * @notice 获取所有者拥有的所有 Agent IDs
     * @param owner 所有者地址
     * @return agentIds Agent ID 数组
     */
    function getOwnerAgents(address owner) public view returns (uint256[] memory agentIds) {
        return ownerAgents[owner];
    }

    /**
     * @notice 检查 Agent 是否存在且激活
     * @param agentId Agent ID
     * @return exists 是否存在
     */
    function agentExists(uint256 agentId) public view returns (bool exists) {
        return identities[agentId].owner != address(0) && identities[agentId].active;
    }
}

