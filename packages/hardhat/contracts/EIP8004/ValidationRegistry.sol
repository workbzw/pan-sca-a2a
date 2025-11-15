//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ValidationRegistry
 * @notice EIP-8004 验证注册表
 * @dev 管理 Agent 的验证、证明和争议
 * @dev 使用 OpenZeppelin ReentrancyGuard 防止重入攻击
 */
contract ValidationRegistry is ReentrancyGuard {
    enum ValidationStatus {
        Pending,    // 待验证
        Approved,   // 已通过
        Rejected,   // 已拒绝
        Disputed    // 有争议
    }

    struct Validation {
        uint256 agentId;             // Agent ID
        address validator;           // 验证者地址
        ValidationStatus status;     // 验证状态
        string proofURI;             // 证明 URI（IPFS）
        string notes;                // 验证备注
        uint256 timestamp;           // 验证时间
    }

    struct Dispute {
        uint256 validationId;        // 验证 ID
        address disputer;            // 争议发起者
        string reason;               // 争议原因
        uint256 timestamp;            // 争议时间
        bool resolved;               // 是否已解决
    }

    // Validation ID => Validation
    mapping(uint256 => Validation) public validations;
    
    // Agent ID => Validation IDs
    mapping(uint256 => uint256[]) public agentValidations;
    
    // Validation ID => Dispute
    mapping(uint256 => Dispute) public disputes;
    
    uint256 private nextValidationId = 1;

    // 事件
    event ValidationSubmitted(
        uint256 indexed validationId,
        uint256 indexed agentId,
        address indexed validator,
        ValidationStatus status,
        string proofURI,
        uint256 timestamp
    );
    
    event ValidationUpdated(
        uint256 indexed validationId,
        ValidationStatus newStatus
    );
    
    event DisputeRaised(
        uint256 indexed validationId,
        address indexed disputer,
        string reason
    );

    /**
     * @notice 提交 Agent 验证
     * @param agentId Agent ID
     * @param status 验证状态
     * @param proofURI 证明 URI
     * @param notes 验证备注
     * @return validationId 验证 ID
     * @dev 使用 nonReentrant 防止重入攻击
     */
    function submitValidation(
        uint256 agentId,
        ValidationStatus status,
        string memory proofURI,
        string memory notes
    ) public nonReentrant returns (uint256 validationId) {
        validationId = nextValidationId++;
        
        validations[validationId] = Validation({
            agentId: agentId,
            validator: msg.sender,
            status: status,
            proofURI: proofURI,
            notes: notes,
            timestamp: block.timestamp
        });
        
        agentValidations[agentId].push(validationId);
        
        emit ValidationSubmitted(validationId, agentId, msg.sender, status, proofURI, block.timestamp);
        
        return validationId;
    }

    /**
     * @notice 更新验证状态
     * @param validationId 验证 ID
     * @param newStatus 新状态
     * @dev 使用 nonReentrant 防止重入攻击
     */
    function updateValidationStatus(uint256 validationId, ValidationStatus newStatus) 
        public 
        nonReentrant 
    {
        Validation storage validation = validations[validationId];
        require(validation.validator == msg.sender, "ValidationRegistry: Not validator");
        
        validation.status = newStatus;
        
        emit ValidationUpdated(validationId, newStatus);
    }

    /**
     * @notice 对验证提出争议
     * @param validationId 验证 ID
     * @param reason 争议原因
     * @dev 使用 nonReentrant 防止重入攻击
     */
    function raiseDispute(uint256 validationId, string memory reason) public nonReentrant {
        require(validations[validationId].timestamp > 0, "ValidationRegistry: Validation not found");
        require(disputes[validationId].disputer == address(0), "ValidationRegistry: Dispute exists");
        
        disputes[validationId] = Dispute({
            validationId: validationId,
            disputer: msg.sender,
            reason: reason,
            timestamp: block.timestamp,
            resolved: false
        });
        
        validations[validationId].status = ValidationStatus.Disputed;
        
        emit DisputeRaised(validationId, msg.sender, reason);
    }

    /**
     * @notice 解决争议
     * @param validationId 验证 ID
     * @param finalStatus 最终状态
     * @dev 使用 nonReentrant 防止重入攻击
     */
    function resolveDispute(uint256 validationId, ValidationStatus finalStatus) 
        public 
        nonReentrant 
    {
        Dispute storage dispute = disputes[validationId];
        require(dispute.disputer != address(0), "ValidationRegistry: No dispute");
        require(!dispute.resolved, "ValidationRegistry: Already resolved");
        // 注意：实际应用中应该只有仲裁者可以解决争议
        
        dispute.resolved = true;
        validations[validationId].status = finalStatus;
        
        emit ValidationUpdated(validationId, finalStatus);
    }

    /**
     * @notice 获取 Agent 的所有验证
     * @param agentId Agent ID
     * @return validationIds 验证 ID 数组
     */
    function getAgentValidations(uint256 agentId) public view returns (uint256[] memory validationIds) {
        return agentValidations[agentId];
    }

    /**
     * @notice 获取验证详情
     * @param validationId 验证 ID
     * @return validation 验证结构
     */
    function getValidation(uint256 validationId) public view returns (Validation memory validation) {
        return validations[validationId];
    }
}

