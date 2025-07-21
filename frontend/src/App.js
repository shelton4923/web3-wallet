// App.js

import React, { useState } from "react";
import {
  Wallet,
  isAddress,
  parseEther,
  formatEther,
  JsonRpcProvider,
  Contract,
  parseUnits,
  formatUnits
} from "ethers";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)"
];

const provider = new JsonRpcProvider("https://bsc-testnet-dataseed.bnbchain.org");

const TOKENS = {
  USDT: "0x787A697324dbA4AB965C58CD33c13ff5eeA6295F",
  USDC: "0x342e3aA1248AB77E319e3331C6fD3f1F2d4B36B1",
};

function App() {
  const [walletData, setWalletData] = useState(null);
  const [walletName, setWalletName] = useState("");
  const [searchName, setSearchName] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(null);

  const [selectedToken, setSelectedToken] = useState("USDT");
  const [tokenAddress, setTokenAddress] = useState(TOKENS.USDT);
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenRecipient, setTokenRecipient] = useState("");
  const [tokenBalance, setTokenBalance] = useState("N/A");
  const [tokenDecimals, setTokenDecimals] = useState(18);

  const [txHash, setTxHash] = useState("");
  const [txDetails, setTxDetails] = useState(null);

  const generateAndSaveWallet = async () => {
    if (!walletName.trim()) return alert("Enter a wallet name");

    const wallet = Wallet.createRandom();
    const newWallet = {
      name: walletName,
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase,
    };

    try {
      const res = await fetch("http://localhost:5000/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWallet),
      });

      if (res.ok) {
        alert("Wallet saved successfully!");
        setWalletName("");
      } else {
        alert("Failed to save wallet");
      }
    } catch (err) {
      console.error("Error saving wallet:", err);
    }
  };

  const fetchWalletByName = async () => {
    if (!searchName.trim()) return alert("Enter wallet name to fetch");

    try {
      const res = await fetch(`http://localhost:5000/api/wallet/${searchName}`);
      const data = await res.json();

      if (data.error) {
        alert("Wallet not found");
        setWalletData(null);
        setBalance(null);
      } else {
        setWalletData(data);
        fetchBalance(data.privateKey);
      }
    } catch (err) {
      console.error("Error fetching wallet:", err);
    }
  };

  const fetchBalance = async (privateKey) => {
    try {
      const wallet = new Wallet(privateKey, provider);
      const bal = await provider.getBalance(wallet.address);
      setBalance(formatEther(bal));
    } catch (err) {
      console.error("Error fetching BNB balance:", err);
    }
  };

  const sendTokens = async () => {
    if (!walletData?.privateKey || !isAddress(recipient) || !amount || parseFloat(amount) <= 0) {
      return alert("Invalid BNB send inputs");
    }

    try {
      const wallet = new Wallet(walletData.privateKey, provider);
      const tx = await wallet.sendTransaction({ to: recipient, value: parseEther(amount) });
      await tx.wait();
      alert(`BNB sent! Tx: ${tx.hash}`);
      setAmount("");
      fetchBalance(walletData.privateKey);
    } catch (err) {
      console.error("BNB send error:", err);
    }
  };

  const fetchTokenBalance = async () => {
    const address = TOKENS[selectedToken];
    if (!isAddress(address) || !walletData) return;

    try {
      setTokenAddress(address);
      const wallet = new Wallet(walletData.privateKey, provider);
      const token = new Contract(address, ERC20_ABI, wallet);

      const decimals = await token.decimals();
      const balance = await token.balanceOf(wallet.address);

      setTokenDecimals(decimals);
      setTokenBalance(formatUnits(balance, decimals));
    } catch (err) {
      console.error("Error fetching token balance:", err);
      setTokenBalance("N/A");
    }
  };

  const sendERC20 = async () => {
    const address = TOKENS[selectedToken];
    if (!isAddress(tokenRecipient) || !tokenAmount || parseFloat(tokenAmount) <= 0 || !walletData) {
      return alert("Invalid token send inputs");
    }

    try {
      alert("Initiating token transfer...");
      const wallet = new Wallet(walletData.privateKey, provider);
      const token = new Contract(address, ERC20_ABI, wallet);
      const amountInUnits = parseUnits(tokenAmount, tokenDecimals);
      const tx = await token.transfer(tokenRecipient, amountInUnits);
      await tx.wait();
      alert(`Token sent! Tx: ${tx.hash}`);
      setTokenAmount("");
      fetchTokenBalance();
    } catch (err) {
      console.error("Token send error:", err);
    }
  };

  const verifyTransaction = async () => {
    try {
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);
      setTxDetails({
        ...tx,
        status: receipt?.status === 1 ? "Success" : "Failed",
        blockNumber: tx?.blockNumber?.toString(16),
      });
    } catch (error) {
      console.error("Error verifying transaction:", error);
      setTxDetails(null);
      alert("Transaction not found");
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "Arial", background: "#f7f7f7", color: "#222", minHeight: "100vh" }}>
      <h2 style={{ color: "#2563eb" }}>🪙 ERC20 & BNB Wallet</h2>

      <div style={{ marginBottom: 20 }}>
        <input placeholder="Wallet Name" value={walletName} onChange={(e) => setWalletName(e.target.value)} style={styles.input} />
        <button onClick={generateAndSaveWallet} style={styles.buttonBlue}>Generate & Save</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input placeholder="Fetch Wallet by Name" value={searchName} onChange={(e) => setSearchName(e.target.value)} style={styles.input} />
        <button onClick={fetchWalletByName} style={styles.buttonGreen}>Fetch Wallet</button>
      </div>

      <div style={{ marginBottom: 20, border: "1px solid #ccc", padding: 16, borderRadius: 10 }}>
        <h3>🔍 Verify Any Transaction</h3>
        <input placeholder="Enter transaction hash" value={txHash} onChange={(e) => setTxHash(e.target.value)} style={styles.input} />
        <button onClick={verifyTransaction} style={styles.buttonGray}>Verify</button>
        {txDetails && (
          <div style={{ marginTop: "10px" }}>
            <p><b>From:</b> {txDetails.from}</p>
            <p><b>To:</b> {txDetails.to}</p>
            <p><b>Value:</b> {txDetails.value ? formatEther(txDetails.value) + " BNB" : "N/A"}</p>
            <p><b>Block:</b> {parseInt(txDetails.blockNumber, 16)}</p>
            <p><b>Status:</b> {txDetails.status}</p>
            <p><b>Tx Hash:</b> {txDetails.hash}</p>
          </div>
        )}
      </div>

      {walletData && (
        <div style={styles.card}>
          <p><b>Address:</b> {walletData.address}</p>
          <p><b>Private Key:</b> {walletData.privateKey}</p>
          <p><b>BNB:</b> {balance ?? "..."}</p>

          <input placeholder="Recipient Address" value={recipient} onChange={(e) => setRecipient(e.target.value)} style={styles.input} />
          <input placeholder="Amount (BNB)" value={amount} onChange={(e) => setAmount(e.target.value)} style={styles.input} />
          <button onClick={sendTokens} style={styles.buttonBlue}>Send BNB</button>

          <hr />

          <div>
            <label><b>Select Token:</b> </label>
            <select
              value={selectedToken}
              onChange={(e) => {
                setSelectedToken(e.target.value);
                setTokenAddress(TOKENS[e.target.value]);
              }}
              style={{ ...styles.input, width: "320px" }}
            >
              <option value="USDT">USDT</option>
              <option value="USDC">USDC</option>
            </select>
            <button onClick={fetchTokenBalance} style={styles.buttonGray}>Get Token Balance</button>
            <p><b>Token Balance:</b> {tokenBalance}</p>

            <input placeholder="Recipient Address" value={tokenRecipient} onChange={(e) => setTokenRecipient(e.target.value)} style={styles.input} />
            <input placeholder="Amount (Token)" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} style={styles.input} />
            <button onClick={sendERC20} style={styles.buttonGreen}>Send Token</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  input: {
    padding: "10px",
    width: "300px",
    margin: "6px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    fontSize: "15px",
  },
  buttonBlue: {
    padding: "10px 16px",
    margin: "6px",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold"
  },
  buttonGreen: {
    padding: "10px 16px",
    margin: "6px",
    backgroundColor: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold"
  },
  buttonGray: {
    padding: "10px 16px",
    margin: "6px",
    backgroundColor: "#6b7280",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold"
  },
  card: {
    backgroundColor: "white",
    padding: 20,
    marginTop: 20,
    borderRadius: 10,
    boxShadow: "0 0 10px rgba(0,0,0,0.1)",
  }
};

export default App;
