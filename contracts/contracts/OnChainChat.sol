// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OnChainChat {
    struct Message {
        address sender;
        string content;
        uint256 timestamp;
    }

    Message[] public messages;

    event MessagePosted(address indexed sender, uint256 indexed index, uint256 timestamp);

    /**
     * @notice Post a new message to the chat
     * @param content The message content
     * @return index The index of the posted message
     */
    function postMessage(string calldata content) external returns (uint256 index) {
        require(bytes(content).length > 0, "Message cannot be empty");
        require(bytes(content).length <= 500, "Message too long");

        index = messages.length;
        messages.push(Message({
            sender: msg.sender,
            content: content,
            timestamp: block.timestamp
        }));

        emit MessagePosted(msg.sender, index, block.timestamp);
    }

    /**
     * @notice Get a specific message by index
     * @param index The index of the message
     * @return The message at the given index
     */
    function getMessage(uint256 index) external view returns (Message memory) {
        require(index < messages.length, "Message does not exist");
        return messages[index];
    }

    /**
     * @notice Get the total number of messages
     * @return The total message count
     */
    function getMessageCount() external view returns (uint256) {
        return messages.length;
    }

    /**
     * @notice Get multiple messages in a range
     * @param startIndex The starting index (inclusive)
     * @param count The number of messages to retrieve
     * @return msgs Array of messages
     */
    function getMessages(uint256 startIndex, uint256 count) external view returns (Message[] memory msgs) {
        require(startIndex < messages.length, "Start index out of bounds");

        uint256 end = startIndex + count;
        if (end > messages.length) {
            end = messages.length;
        }

        uint256 resultCount = end - startIndex;
        msgs = new Message[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            msgs[i] = messages[startIndex + i];
        }
    }

    /**
     * @notice Get the latest N messages
     * @param count The number of recent messages to retrieve
     * @return msgs Array of the latest messages
     */
    function getLatestMessages(uint256 count) external view returns (Message[] memory msgs) {
        if (count > messages.length) {
            count = messages.length;
        }

        if (count == 0) {
            return new Message[](0);
        }

        msgs = new Message[](count);
        uint256 startIndex = messages.length - count;

        for (uint256 i = 0; i < count; i++) {
            msgs[i] = messages[startIndex + i];
        }
    }
}
