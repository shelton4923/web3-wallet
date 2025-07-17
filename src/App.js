import React, { useState } from "react";
import { ethers } from "ethers";

function App() {
  const [walletName, setWalletName] = useState("");
  const [searchName, setSearchName] = useState("");
  const [walletData, setWalletData] = useState(null);

  // Generate and save wallet (does NOT show details immediately)
  const generateAndSaveWallet = async () => {
    if (!walletName.trim()) {
      alert("Enter a name for the wallet");
      return;
    }

    const wallet = ethers.Wallet.createRandom();

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

      const result = await res.json();
      alert(result.message || "Wallet saved!");
      setWalletName("");
    } catch (err) {
      console.error("Error saving wallet:", err);
      alert("Failed to save wallet");
    }
  };

  // Fetch wallet details by name (shows on UI)
  const fetchWalletByName = async () => {
    if (!searchName.trim()) {
      alert("Enter a wallet name to search");
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/wallet/${searchName}`);
      const data = await res.json();

      if (data.error) {
        alert("Wallet not found");
        setWalletData(null);
      } else {
        setWalletData(data);
      }
    } catch (err) {
      console.error("Error fetching wallet:", err);
      alert("Failed to fetch wallet");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px", fontFamily: "Arial, sans-serif" }}>
      <h1>🔐 Wallet App</h1>

      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Enter name to create wallet"
          value={walletName}
          onChange={(e) => setWalletName(e.target.value)}
          style={{ padding: "8px", width: "250px", marginRight: "10px" }}
        />
        <button onClick={generateAndSaveWallet}>Generate & Save Wallet</button>
      </div>

      <div style={{ marginBottom: "30px" }}>
        <input
          type="text"
          placeholder="Enter name to fetch wallet"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          style={{ padding: "8px", width: "250px", marginRight: "10px" }}
        />
        <button onClick={fetchWalletByName}>Fetch Wallet by Name</button>
      </div>

      {walletData && (
        <div style={{ textAlign: "left", margin: "0 auto", width: "500px" }}>
          <h2>🔒 Wallet Info</h2>
          <p><strong>Name:</strong> {walletData.name}</p>
          <p><strong>Address:</strong> {walletData.address}</p>
          <p><strong>Private Key:</strong> {walletData.privateKey}</p>
          <p><strong>Mnemonic:</strong> {walletData.mnemonic}</p>
        </div>
      )}
    </div>
  );
}

export default App;
