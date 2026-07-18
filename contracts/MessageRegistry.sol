// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract MessageRegistry {
    address public immutable owner;

    string private message;

    error EmptyMessage();
    error NotOwner();

    event MessageUpdated(
        address indexed sender,
        string previousMessage,
        string newMessage
    );

    constructor(string memory initialMessage) {
        if (bytes(initialMessage).length == 0) revert EmptyMessage();

        owner = msg.sender;
        message = initialMessage;
    }

    function readMessage() external view returns (string memory) {
        return message;
    }

    function writeMessage(string calldata newMessage) external {
        if (msg.sender != owner) revert NotOwner();
        if (bytes(newMessage).length == 0) revert EmptyMessage();

        string memory previousMessage = message;
        message = newMessage;

        emit MessageUpdated(msg.sender, previousMessage, newMessage);
    }
}
