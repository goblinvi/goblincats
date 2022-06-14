import { expect } from "chai";
import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
// eslint-disable-next-line node/no-missing-import
import { whitelist } from "../constants/whitelist";
import keccak256 from "keccak256";
import "@nomiclabs/hardhat-ethers";
function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// for this test we have used whitelist time as 30 seconds and free mint as 3;
// we should change free mint as 1000 when mainnet deploy and whtielist time as 1800
describe("FirstToken", function () {
  it("Can user mint", async () => {
    const MyToken = await ethers.getContractFactory("FirstToken");
    const [owner, wlUser, freeUser, publicUser] = await ethers.getSigners();
    console.log("owner: ", owner.address);
    console.log("wlUser: ", wlUser.address);
    console.log("freeUser: ", freeUser.address);
    console.log("publicUser: ", publicUser.address);
    console.log("wlUserList: ", whitelist);

    const myToken = await MyToken.connect(owner).deploy();
    await myToken.deployed();
    const tree = new MerkleTree(whitelist, keccak256, {
      hashLeaves: true,
      sortPairs: true,
    });

    // owner set root
    const root = tree.getRoot().toString("hex");
    await (await myToken.connect(owner).setRoot(`0x${root}`)).wait();
    console.log("root: ", root);

    // ---------- owner also can set whitelist mint duration, if not default is 30min
    // for only test purpose you can set duration as 10 seconds
    // when mainnet deploy you should change 10 to 1800;
    await (await myToken.connect(owner).setWlMintTimeStamp(10)).wait();

    // only owner can mint free for all tokens even whitelist tokens, free tokens and public sale minting
    await (await myToken.connect(owner).specialMint(1)).wait();

    const leaf = keccak256(wlUser.address);
    const proof = tree.getHexProof(leaf);
    console.log("proof: ", proof);
    const isVerified = tree.verify(proof, leaf, root);
    console.log("isVerified", isVerified);
    await (await myToken.connect(wlUser).whiteListMint(proof)).wait();

    console.log("wlUserMinted done for wlUser: \n");
    expect((await myToken.balanceOf(wlUser.address)).toNumber()).to.be.eq(2);

    // -------------wlUser can't wlMint twice, if remove slash reverted from contract
    // await (await myToken.connect(wlUser).whiteListMint(proof)).wait();
    // console.log(
    //   "again Minted:",
    //   (await myToken.balanceOf(wlUser.address)).toNumber()
    // );

    // ------------------freeUser can't whitelist mint ----------------;
    // const freeUserLeaf = keccak256(freeUser.address);
    // const freeUserProof = tree.getHexProof(freeUserLeaf);
    // const freeUserIsVerified = tree.verify(freeUserProof, freeUserLeaf, root);
    // console.log("freeUser is Verified?", freeUserIsVerified);
    // console.log("freeUser can whitelist mint\n");
    // await (await myToken.connect(freeUser).whiteListMint(freeUserProof)).wait();

    // --------------------free user can't free mint within certain time-------
    // await (await myToken.connect(freeUser).freeMint()).wait();
    // console.log(
    //   "FreeUser Minted: balance\n",
    //   (await myToken.balanceOf(freeUser.address)).toNumber()
    // );
    // expect((await myToken.balanceOf(freeUser.address)).toNumber()).to.be.eq(1);

    // --------------free users should wait for 30 mins for free mint --------
    await sleep(10000); // for only test user can set MAX_FREE_SUPPLY = 3

    await (await myToken.connect(freeUser).freeMint()).wait();
    console.log(
      "FreeUser Minted after wl time: cur balance\n",
      (await myToken.balanceOf(freeUser.address)).toNumber()
    );
    expect((await myToken.balanceOf(freeUser.address)).toNumber()).to.be.eq(1);


    // --------------owner can cancel minting of users if then no one can mint-----------------
    // await (await myToken.connect(owner).pause()).wait();

    // -------------owner (contract deployer) can also free mint ------------------
    await (await myToken.connect(owner).freeMint()).wait();
    console.log(
      "owner Minted after wl time: cur balance should be 2\n",
      (await myToken.balanceOf(owner.address)).toNumber()
    );
    expect((await myToken.balanceOf(owner.address)).toNumber()).to.be.eq(2);

    // -------------whitelist user can also free mint ------------------
    await (await myToken.connect(wlUser).freeMint()).wait();
    console.log(
      "wlUser Minted after wl time that is free mint: cur balance\n",
      (await myToken.balanceOf(wlUser.address)).toNumber()
    );
    expect((await myToken.balanceOf(wlUser.address)).toNumber()).to.be.eq(3);

    // eslint-disable-next-line no-unused-expressions
    const maxFreeSupply = (await myToken.MAX_FREE_SUPPLY()).toNumber;
    console.log("maxFreeSupplied", maxFreeSupply);

    const revealBeginTimeStamp = await myToken.revealBeginTimeStamp();
    console.log("revealBeginTimeStamp: ", revealBeginTimeStamp.toNumber());

    await sleep(5000);
    const revealBaseUri =
      "https://ipfs.io/ipfs/QmUWkgJ1vnsqoppuQju2NiSiLCtEVCm8zAR6WU4Z53iqHH/";
    await (await myToken.connect(owner).setBaseURI(revealBaseUri)).wait();
    // -------------after free mint over (1000) public users start public minting (pay for mint)------------------
    await (
      await myToken
        .connect(publicUser)
        .publicMint(3, { value: "9000000000000000" })
    ).wait();
    console.log(
      "publicUser Minted after wl time that is public mint: cur balance should be 3\n",
      (await myToken.balanceOf(publicUser.address)).toNumber()
    );
    expect((await myToken.balanceOf(publicUser.address)).toNumber()).to.be.eq(
      3
    );

    // only owner can mint free for all tokens even whitelist tokens, free tokens and public sale minting
    await (await myToken.connect(owner).specialMint(1)).wait();
    await (await myToken.connect(owner).specialMint(1)).wait();
    await (await myToken.connect(owner).specialMint(2)).wait();

    console.log(
      "owner balance after 3 special mint",
      (await myToken.balanceOf(owner.address)).toNumber()
    );

    // const provider = network.provider;
    // const rawValBefore = await provider;
    // const realValBefore = ethers.utils.formatEther(rawValBefore);
    const balance = await owner.getBalance();
    console.log("owner original balance: ", balance);

    console.log("owner withdrawed");

    await myToken.connect(owner).withdrawFunds();
    const realVal = await owner.getBalance();
    console.log("owner withdrawed so his balance", realVal);

    // ----------------not everyone can withdraw money from contract, only owner can withdraw
    // console.log("wlUser withdrawed");
    // await (
    //   await myToken.connect(wlUser).withdrawFunds("9000000000000000")
    // ).wait();
    // const wlUserrawVal = await provider.getBalance(wlUser.address);
    // const wlUserrealVal = ethers.utils.formatEther(wlUserrawVal);
    // console.log("wlUser withdrawed so his balance", wlUserrealVal)
  });
});
