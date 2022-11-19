// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract ZoopR is ERC20, ERC20Burnable, ERC20Snapshot, Ownable, ERC20Permit {
    constructor() ERC20("ZoopR", "ZOOP") ERC20Permit("ZoopR") {
        uint256 _supply = 1_000_000_000 ether;
        _mint(msg.sender, _supply);
    }

    function snapshot() external onlyOwner {
        _snapshot();
    }

    // The following functions are overrides required by Solidity.
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Snapshot)
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}