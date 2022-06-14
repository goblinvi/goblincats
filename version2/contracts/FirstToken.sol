//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract FirstToken is ERC721, ERC721Enumerable, Pausable, Ownable {
    using Counters for Counters.Counter;
    using Strings for uint256;
    // Merkle Tree root
    bytes32 private root=0x4e03d5d8b9aae36645e4b3450070927392b7b2aaa9cc15e0eb85ba8d1dfe2c17;

    uint256 public constant PRICE = 0.003 ether;
    uint256 public wlMintBeginTimeStamp;
    uint256 public wlMintEndTimeStamp;
    uint256 public revealBeginTimeStamp;
    uint256 public constant MAX_SUPPLY = 6969;
    uint256 public constant MAX_WL_SUPPLY = 1000;
    uint256 public constant MAX_FREE_SUPPLY = 1000; // when mainnet deploy you should change this as 1000

    string public baseUri;

    uint256 public totalWlMintedNumber;
    uint256 public totalFreeMintedNumber;
    uint256 public totalPublicMintNumber;

    uint256 public publicMintLimitNumber = 10;

    mapping(address => bool) public whitelistMinted;
    mapping(address => bool) public freeMinted;
    mapping(address => uint256) public publicMintedCount;
    Counters.Counter private _tokenIdCounter;

    constructor() ERC721("FirstToken", "FTK") {
        wlMintBeginTimeStamp = block.timestamp;
        wlMintEndTimeStamp = wlMintBeginTimeStamp + 30 minutes; // 30min for wl mint default;
        revealBeginTimeStamp = block.timestamp + 1 minutes; // 1hour for mainnet deploy;
        baseUri = "https://ipfs.io/ipfs/Qmcdp97qVbkSMLBb76LrL3eUienrLYmJ6SWqG1N7JcSya6/";
    }

    function _baseURI() internal view override returns (string memory) {
        return baseUri ;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        whenNotPaused
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function safeMint(address to, uint256 amount) internal {
        for (uint256 index = 0; index < amount; index++) {
            uint256 tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();
            _safeMint(to, tokenId);
        }
    }
    // check if current mint status 
    function canWhitelistMint() public view returns(bool) {
        if ( block.timestamp <= wlMintEndTimeStamp && totalWlMintedNumber + 2 <= MAX_WL_SUPPLY) return true;
        else return false;
    }

    function canFreeMint() public view returns(bool) {
        if ( block.timestamp > wlMintEndTimeStamp && totalFreeMintedNumber < MAX_FREE_SUPPLY ) return true;
        else return false;
    }

    function canPublicMint() public view returns(bool) {

            if ( totalFreeMintedNumber == MAX_FREE_SUPPLY && totalSupply() < MAX_SUPPLY) return true;
            else return false;
    }
    // admin should set these part for users to mint
    function setWlMintTimeStamp(uint256 _duration) external onlyOwner {
        wlMintEndTimeStamp = wlMintBeginTimeStamp + _duration;
    }
    // for wl List user
    function setRoot(bytes32 _newRoot) external onlyOwner {
        root = _newRoot;
    }

    function setBaseURI(string memory _baseUri) external onlyOwner {
        require( block.timestamp >= revealBeginTimeStamp, "It didn't reach certain time.");
        baseUri = _baseUri;
    }

    function whiteListMint(bytes32[] memory _proof) external {
        if ( canWhitelistMint()) {
            require(!whitelistMinted[msg.sender], "You has already whitelist minted.");
            bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
            require(MerkleProof.verify(_proof, root, leaf) == true, "You are not a whitelist user.");

            safeMint(msg.sender, 2);
            whitelistMinted[msg.sender] = true;
            totalWlMintedNumber += 2;
        }
    }

    function freeMint() external {
        if ( canFreeMint()) {
            require(!freeMinted[msg.sender], "You has already free mint.");
            safeMint(msg.sender, 1);
            totalFreeMintedNumber += 1;
            freeMinted[msg.sender] = true;
        }
    }
    
    function publicMint(uint256 _amount) external payable {
        if (canPublicMint()) {
            require(msg.value >= _amount * PRICE, "Insufficient funds.");
            require(totalSupply() + _amount <= MAX_SUPPLY, "Total Amount Exceeds.");
            require(publicMintedCount[msg.sender] + _amount <= publicMintLimitNumber, "Public Minted Number Exceeds.");
            safeMint(msg.sender, _amount);
            publicMintedCount[msg.sender] += _amount;
            totalPublicMintNumber += _amount;
        }
    }

    function withdrawFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(msg.sender).transfer(balance);
    }

    function specialMint(uint256 _amount) external onlyOwner {
        require(totalSupply() + _amount <= MAX_SUPPLY, "Total Amount Exceeds.");
        safeMint(msg.sender, _amount);
    }

    function tokenURI(uint256 tokenId) public view override returns(string memory) {
        require(_exists(tokenId), "Token Does Not Exist.");
        return 
            string(
                abi.encodePacked(
                    baseUri,
                    tokenId.toString(),
                    ".json"
                )
            );
    }
}