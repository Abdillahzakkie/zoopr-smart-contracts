// SPDX-License-Identifier: GPLV3
pragma solidity 0.8.12;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract UniqueNameToken is ERC721, ERC721URIStorage, EIP712, AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    IERC721 public ZooprPass;
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    address private _owner;
    string public STAGE;
    uint256 public STAGE_CAP;
    uint256 public MINTING_FEE;
    uint256 public CAP;

    mapping(string => bool) public minted;
    mapping(address => bool) public genesisPass;
    mapping(string => uint256) private _stageCount;


    event TOTAL_CAP(uint256 cap);
    event STAGE_DETAIL(string stage, uint256 stageCap, uint256 fee);

    constructor(IERC721 _zooprPass) ERC721("UniqueNameToken", "UNT") EIP712("UniqueNameToken", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(VALIDATOR_ROLE, _msgSender());

        _owner = _msgSender();
        ZooprPass = _zooprPass;
        updateCap(100_000);
        updateStageDetail("SEED", 1000, 0.08 ether);
    }

    receive() external payable {
        revert("UniqueNameToken: Direct ETHER deposit failed!");
    }

    function mint(bytes calldata _data) external payable nonReentrant {
        (address _signer, string memory _username, string memory _tokenURI, uint256 _fees) = _getSignedData(_data);
        uint256 _tokenId = _tokenIdCounter.current();
        require(_validate(_signer, _username, _tokenURI, _tokenId));
        require(msg.value > 0 && msg.value >= _fees, "UniqueNameToken: Insufficient minting fees");

        (bool _success,) = payable(_owner).call{value: _fees}("");
        require(_success, "UniqueNameToken: Payment Failed!");

        _mint(_username, _tokenURI, _tokenId);
        // Should refund excess fees
        uint256 _refund = msg.value - _fees;
        if (_refund > 0) {
            (bool _refundStatus,) = payable(_msgSender()).call{value: _refund}("");
            require(_refundStatus, "UniqueNameToken: Excess refund Failed!");
        }
    }

    function genesisPassMint(bytes calldata _data) external nonReentrant {
        (address _signer, string memory _username, string memory _tokenURI,) = _getSignedData(_data);
        uint256 _tokenId = _tokenIdCounter.current();
        require(_validate(_signer, _username, _tokenURI, _tokenId));
        require(ZooprPass.balanceOf(_msgSender()) > 0, "UniqueNameToken: User does not have Genesis Pass");
        require(!genesisPass[_msgSender()], "UniqueNameToken: ZoopR Pass free mint have already been used");

        _mint(_username, _tokenURI, _tokenId);
        genesisPass[_msgSender()] = true;
    }

    function _mint(string memory _username, string memory _tokenURI, uint256 _tokenId) private {
        // increment tokenId
        _tokenIdCounter.increment();

        minted[_username] = true;
        _safeMint(_msgSender(), _tokenId);
        _setTokenURI(_tokenId, _tokenURI);
        _stageCount[STAGE]++;
    }

    function updateCap(uint256  _cap) public onlyRole(DEFAULT_ADMIN_ROLE) {
        emit TOTAL_CAP(_cap);
        CAP = _cap;
    }

    function updateStageDetail(string memory _stage, uint256 _stageCap, uint256 _mintFee) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_stageCap <= CAP, "ZooprPass: StageCap exceeds totalCap");
        emit STAGE_DETAIL(_stage, _stageCap, _mintFee);

        STAGE = _stage;
        STAGE_CAP = _stageCap;
        MINTING_FEE = _mintFee;
        _stageCount[_stage] = 0;
    }

    function _getSignedData(bytes calldata _data) internal view returns(address, string memory, string memory, uint256) {
        (bytes memory _signature, , string memory _username, string memory _tokenURI, uint256 _fees, uint256 _deadline) = _decode(_data);
        require(_deadline >= block.timestamp, "UniqueNameToken: Signature expired");

        bytes32 _digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("UNT(address account,string username,string tokenURI,string fees,string deadline)"), 
                    _msgSender(), 
                    keccak256(bytes(_username)),
                    keccak256(bytes(_tokenURI)),
                    keccak256(bytes(Strings.toString(_fees))),
                    keccak256(
                        bytes(Strings.toString(_deadline))
                    )
                )
            )
        );
        address _signer = ECDSA.recover(_digest, _signature);
        return (_signer, _username, _tokenURI, _fees);
    }

    function _validate(address _signer, string memory _username, string memory _tokenURI,  uint256 _tokenId) internal view returns(bool) {
        require(hasRole(VALIDATOR_ROLE, _signer), "UniqueNameToken: Invalid mint data received!");
        require(!minted[_username], "UniqueNameToken: Username has already been minted");
        require(keccak256(abi.encode(_tokenURI)) != keccak256(abi.encode("")), "UniqueNameToken: Invalid tokenURI received");
        require(_tokenId < CAP, "UniqueNameToken: Maximum UNT cap exceeded");
        require(_stageCount[STAGE] < STAGE_CAP, "UniqueNameToken: Stage Cap exceeded");
        return true;
    }

    function owner() external view returns(address) {
        return _owner;  
    }

    function encode(bytes memory _signature, address _account, string calldata _username, string calldata _tokenURI, uint256 _mintFee, uint256 _deadline) external pure returns(bytes memory _data) {
        _data = abi.encode(_signature, _account, _username, _tokenURI, _mintFee, _deadline);
    }

    function _decode(bytes calldata _encoded) private pure returns(bytes memory, address, string memory, string memory, uint256, uint256) {
        (bytes memory _signature, address _account, string memory username, string memory _tokenURI,  uint256 _fees, uint256 _deadline) = abi.decode(_encoded, (bytes, address, string, string, uint256, uint256));
        return (_signature, _account, username, _tokenURI, _fees, _deadline);
    }

    function chainId() external view returns(uint256) {
        return block.chainid;
    }

    function stageCount() external view returns(uint256) {
        return _stageCount[STAGE];
    }

    // The following functions are overrides required by Solidity.

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}