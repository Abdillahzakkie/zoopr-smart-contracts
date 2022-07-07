// SPDX-License-Identifier: 0.8.10
pragma solidity 0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract ZooprPass is ERC721, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;
    string public stage;
    uint256 public stageCap;
    uint256 public fees;
    uint256 public totalCap;
    string private _tokenURI;


    event STAGE_DETAIL(string stage, uint256 stageCap, uint256 fee);

    constructor(string memory __tokenURI) ERC721("ZooprPass", "ZPASS") {
        _tokenURI = __tokenURI;
        totalCap = 1000;
        updateStageDetail("SEED", totalCap, 1 ether);
    }

    receive() external payable {
        revert("ZooprPass: ETHER deposit failed!");
    }

    function mint() external payable nonReentrant {
        uint256 _tokenId = _tokenIdCounter.current();

        require(msg.value >= fees, "ZooprPass: insufficient mint fees");
        require(_tokenId < totalCap, "ZooprPass: totalCap exceeded");
        require(_tokenId < stageCap, "ZooprPass: stageCap exceeded");
        require(balanceOf(_msgSender()) < 2, "ZooprPass: max mint exceeded");


        (bool _paymentStatus,) = payable(owner()).call{value: fees}("");
        require(_paymentStatus, "ZooprPass: Payment Failed!");

        _tokenIdCounter.increment();
        _safeMint(_msgSender(),_tokenId);

        // Should refund excess fees
        uint256 _refund = msg.value - fees;
        if (_refund > 0) {
            (bool _refundStatus,) = payable(_msgSender()).call{value: _refund}("");
            require(_refundStatus, "ZooprPass: Excess refund Failed!");
        }
    }

    function updateStageDetail(string memory _stage, uint256 _stageCap, uint256 _fee) public onlyOwner {
        require(_stageCap <= totalCap, "ZooprPass: StageCap exceeds totalCap");
        stage = _stage;
        stageCap = _stageCap;
        fees = _fee;
        emit STAGE_DETAIL(_stage, stageCap, _fee);
    }

    function updateTokenURI(string calldata __tokenURI) public onlyOwner {
        _tokenURI = __tokenURI;
    }

    function withdraw() external onlyOwner {
        (bool _success,) = payable(owner()).call{value: address(this).balance}("");
        require(_success, "ZooprPass: Withdrawal Failed!");
    }

    function _burn(uint256 tokenId) internal override(ERC721) {
        super._burn(tokenId);
    }

    function tokenURI(uint256) public view override(ERC721) returns (string memory) {
        // return super.tokenURI(tokenId);
        return _tokenURI;
    }
}

