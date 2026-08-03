const { ethers } = require('ethers');

async function test() {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const adminKey = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const signer = new ethers.Wallet(adminKey, provider);

  const abi = [
    'function mint(string _coreTxId, address _to, uint256 _amount) external',
    'function burn(string _coreTxId, address _from, uint256 _amount) external',
    'function balanceOf(address owner) view returns (uint256)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function hasRole(bytes32 role, address account) view returns (bool)',
    'function MINTER_ROLE() view returns (bytes32)',
    'function BURNER_ROLE() view returns (bytes32)',
  ];

  const userAddress = '0xe5b989935D085BAd7c121A139F8d38F8A3A436e0';
  const vndAddress = '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512';
  const usdAddress = '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0';

  const vnd = new ethers.Contract(vndAddress, abi, signer);
  const usd = new ethers.Contract(usdAddress, abi, signer);

  console.log('Signer address:', signer.address);
  console.log('VND Name:', await vnd.name(), 'Symbol:', await vnd.symbol());
  console.log('USD Name:', await usd.name(), 'Symbol:', await usd.symbol());

  const minterRole = await vnd.MINTER_ROLE();
  const burnerRole = await vnd.BURNER_ROLE();
  console.log('Signer has VND Minter Role?', await vnd.hasRole(minterRole, signer.address));
  console.log('Signer has VND Burner Role?', await vnd.hasRole(burnerRole, signer.address));
  console.log('Signer has USD Minter Role?', await usd.hasRole(minterRole, signer.address));

  console.log('User VND balance:', ethers.formatUnits(await vnd.balanceOf(userAddress), 18));
  console.log('User USD balance:', ethers.formatUnits(await usd.balanceOf(userAddress), 18));

  // Let's test minting 100 USD to user
  console.log('\nTesting Mint USD to user...');
  const txMint = await usd.mint(`test_${Date.now()}`, userAddress, ethers.parseUnits('100', 18));
  await txMint.wait();
  console.log('Minted 100 USD! New USD balance:', ethers.formatUnits(await usd.balanceOf(userAddress), 18));
}

test().catch(console.error);
