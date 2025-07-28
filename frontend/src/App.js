import React, { useState } from "react";
import {
    Wallet,
    isAddress,
    parseEther,
    formatEther,
    JsonRpcProvider,
    Contract,
    parseUnits,
    formatUnits,
    Interface,
} from "ethers";
import { QRCodeCanvas } from "qrcode.react";
import { Toaster, toast } from "react-hot-toast";
import { Wallet as WalletIcon, Search, CheckCircle, AlertCircle, Send, QrCode, Clipboard, Copy } from 'lucide-react';

// Setup the provider to connect to the Binance Smart Chain Testnet
const provider = new JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545");

// ABI for standard ERC20 functions
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint amount) returns (bool)",
];

// Configuration for supported tokens
const tokens = {
    BNB: { symbol: "BNB" },
    USDT: {
        symbol: "USDT",
        address: "0x787A697324dbA4AB965C58CD33c13ff5eeA6295F",
        decimals: 18,
    },
    USDC: {
        symbol: "USDC",
        address: "0x342e3aA1248AB77E319e3331C6fD3f1F2d4B36B1",
        decimals: 18,
    },
};

// A reusable Card component for consistent styling
const Card = ({ children, className }) => (
    <div className={`bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200 ${className}`}>
        {children}
    </div>
);

// A reusable Button component
const Button = ({ onClick, children, className = '', disabled = false }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-white transition-all duration-300 ${className} ${disabled ? 'bg-gray-400 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
    >
        {children}
    </button>
);

export default function App() {
    const [walletName, setWalletName] = useState("");
    const [wallet, setWallet] = useState(null);
    const [searchName, setSearchName] = useState("");
    const [recipient, setRecipient] = useState("");
    const [amount, setAmount] = useState("");
    const [selectedToken, setSelectedToken] = useState("BNB");
    const [tokenBalance, setTokenBalance] = useState(null);
    const [txHash, setTxHash] = useState("");
    const [txInfo, setTxInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [myTransactions, setMyTransactions] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    const fetchMyTransactions = async () => {
     try {
    const res = await fetch(`http://localhost:5000/api/transactions/${searchName || walletName}`);
    const data = await res.json();
    setMyTransactions(data);
  } catch (err) {
    console.error("Error fetching transaction history", err);
  }
};

    const handleAction = async (action, successMessage) => {
        setLoading(true);
        try {
            await action();
            if (successMessage) toast.success(successMessage);
        } catch (err) {
            toast.error(err.message || "An error occurred.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    
    const generateWallet = () => handleAction(async () => {
        if (!walletName) throw new Error("Please enter a wallet name");
        const newWallet = Wallet.createRandom();
        setWallet(newWallet);
        const data = { name: walletName, address: newWallet.address, privateKey: newWallet.privateKey };
        await fetch("http://localhost:5000/api/wallet/save", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
        });
    }, `Wallet '${walletName}' created and saved!`);

    const fetchWallet = () => handleAction(async () => {
        if (!searchName) throw new Error("Enter wallet name to search");
        setWallet(null);
        const res = await fetch(`http://localhost:5000/api/wallet/${searchName}`);
        const data = await res.json();
        if (!data.privateKey) throw new Error("Wallet not found!");
        setWallet(new Wallet(data.privateKey, provider));
    }, "Wallet fetched successfully!");

    const getTokenBalance = () => handleAction(async () => {
        if (!wallet) return;
        let balance;
        if (selectedToken === "BNB") {
            balance = await provider.getBalance(wallet.address);
            setTokenBalance(formatEther(balance));
        } else {
            const token = tokens[selectedToken];
            const contract = new Contract(token.address, ERC20_ABI, provider);
            balance = await contract.balanceOf(wallet.address);
            setTokenBalance(formatUnits(balance, token.decimals));
        }
    }, "Balance updated!");

    const sendToken = () => handleAction(async () => {
        if (!wallet || !recipient || !amount) throw new Error("Missing input");
        if (!isAddress(recipient)) throw new Error("Invalid address");
        const signer = wallet.connect(provider);
        let tx;
        if (selectedToken === "BNB") {
            tx = await signer.sendTransaction({ to: recipient, value: parseEther(amount) });
        } else {
            const token = tokens[selectedToken];
            const contract = new Contract(token.address, ERC20_ABI, signer);
            tx = await contract.transfer(recipient, parseUnits(amount, token.decimals));
        }
        setTxHash(tx.hash);
        toast.success("Transaction sent! Verifying...");
        await tx.wait(); // Wait for transaction to be mined
        await fetch("http://localhost:5000/api/transactions/save", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    walletName: searchName || walletName,
    txHash: tx.hash,
    from: wallet.address,
    to: recipient,
    amount,
    tokenSymbol: selectedToken
  })
});

        verifyTransaction(tx.hash);
    });

    const verifyTransaction = (hashToVerify = txHash) => handleAction(async () => {
        if (!hashToVerify) throw new Error("Enter transaction hash");
        const tx = await provider.getTransaction(hashToVerify);
        const receipt = await provider.getTransactionReceipt(hashToVerify);
        if (!tx || !receipt) throw new Error("Transaction not found or not yet mined.");
        const iface = new Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
        let decodedLogs = receipt.logs
            .map(log => {
                try {
                    const tokenDetails = Object.values(tokens).find(t => t.address && t.address.toLowerCase() === log.address.toLowerCase());
                    return tokenDetails ? { ...iface.parseLog(log), tokenDetails } : null;
                } catch { return null; }
            }).filter(log => log !== null);
        setTxInfo({ tx, receipt, decodedLogs });
    }, "Transaction verified!");

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard!");
    };

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
            <Toaster position="top-center" reverseOrder={false} />
            <header className="bg-white/60 backdrop-blur-sm sticky top-0 z-10 border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-center">
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <WalletIcon className="text-indigo-600" size={32} />
                        <span>Modern Crypto Wallet</span>
                    </h1>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {loading && <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div></div>}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                    <Card>
                        <h2 className="text-xl font-bold mb-4">Generate Wallet</h2>
                        <input type="text" placeholder="Enter Wallet Name" className="w-full p-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 mb-4" value={walletName} onChange={(e) => setWalletName(e.target.value)} />
                        <Button onClick={generateWallet} className="bg-indigo-600"><WalletIcon size={20} /> Generate & Save</Button>
                    </Card>
                    <Card>
                        <h2 className="text-xl font-bold mb-4">Fetch Wallet</h2>
                        <input type="text" placeholder="Search Wallet Name" className="w-full p-2.5 rounded-lg border focus:ring-2 focus:ring-green-500 mb-4" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
                        <Button onClick={fetchWallet} className="bg-green-500"><Search size={20} /> Fetch Wallet</Button>
                    </Card>
                    <Card>
                        <h2 className="text-xl font-bold mb-4">Verify Transaction</h2>
                        <input type="text" placeholder="Enter Tx Hash" className="w-full p-2.5 rounded-lg border focus:ring-2 focus:ring-gray-700 mb-4" value={txHash} onChange={(e) => setTxHash(e.target.value)} />
                        <Button onClick={() => verifyTransaction()} className="bg-gray-800"><CheckCircle size={20} /> Verify</Button>
                    </Card>
                </div>

                {wallet && (
                    <Card className="mb-10">
                        <h2 className="text-2xl font-bold text-indigo-800 mb-4">Wallet Details</h2>
                        <div className="space-y-3 mb-6 text-sm">
                            <div className="flex items-center gap-3"><strong className="w-24">Address:</strong> <span className="font-mono bg-gray-100 p-1 rounded break-all">{wallet.address}</span><Copy size={16} className="cursor-pointer" onClick={() => copyToClipboard(wallet.address)} /></div>
                            <div className="flex items-center gap-3"><strong className="w-24">Private Key:</strong> <span className="font-mono bg-gray-100 p-1 rounded break-all">{wallet.privateKey.substring(0, 10)}...</span><Copy size={16} className="cursor-pointer" onClick={() => copyToClipboard(wallet.privateKey)} /></div>
                        </div>

                        {showQR && <div className="flex justify-center my-6"><QRCodeCanvas value={wallet.address} size={180} /></div>}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                                <h3 className="font-bold mb-3">Balance</h3>
                                <div className="flex items-center gap-4">
                                    <select className="border p-2 rounded-lg" value={selectedToken} onChange={(e) => {setSelectedToken(e.target.value); setTokenBalance(null);}}>
                                        {Object.keys(tokens).map(key => <option key={key} value={key}>{tokens[key].symbol}</option>)}
                                    </select>
                                    <Button onClick={getTokenBalance} className="bg-indigo-500 text-sm py-2">Get Balance</Button>
                                    <Button
                                     onClick={() => {
                                     setShowHistory(!showHistory);
                                        if (!showHistory) fetchMyTransactions();
                                        }}
                                     className="bg-purple-600 text-sm py-2 mt-3"
>   
                                    {showHistory ? "Hide" : "Show"} Transaction History
                                        </Button>

                                </div>
                                <p className="mt-3 text-lg font-medium text-indigo-800">Balance: {tokenBalance ?? "--"} {selectedToken}</p>
                                <Button onClick={() => setShowQR(!showQR)} className="bg-yellow-500 mt-4 text-sm py-2"><QrCode size={18} /> {showQR ? "Hide QR" : "Show QR"}</Button>
                            </div>
                            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                                <h3 className="font-bold mb-3">Send Tokens</h3>
                                <div className="space-y-3">
                                    <input type="text" placeholder="Recipient Address" className="w-full p-2.5 rounded-lg border" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
                                    <input type="text" placeholder="Amount" className="w-full p-2.5 rounded-lg border" value={amount} onChange={(e) => setAmount(e.target.value)} />
                                    <Button onClick={sendToken} className="bg-green-600"><Send size={18} /> Send {selectedToken}</Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}
                {showHistory && (
  <Card>
    <h2 className="text-xl font-bold mb-4">Transaction History</h2>
    {myTransactions.length === 0 ? (
      <p className="text-gray-500">No transactions found.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Token</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">From</th>
              <th className="px-4 py-2">To</th>
              <th className="px-4 py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {myTransactions.map((tx) => {
              const isSent = tx.from.toLowerCase() === wallet?.address?.toLowerCase();
              const time = new Date(tx.createdAt).toLocaleString();
              return (
                <tr key={tx.txHash} className={isSent ? "text-red-600" : "text-green-600"}>
                  <td className="px-4 py-2">{isSent ? "Sent" : "Received"}</td>
                  <td className="px-4 py-2">{tx.tokenSymbol}</td>
                  <td className="px-4 py-2">{tx.amount}</td>
                  <td className="px-4 py-2">{tx.from.slice(0, 8)}...</td>
                  <td className="px-4 py-2">{tx.to.slice(0, 8)}...</td>
                  <td className="px-4 py-2">{time}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </Card>
)}

                {txInfo && (
                    <Card>
                        <h2 className="text-2xl font-bold mb-4">Transaction Info</h2>
                        <div className={`flex items-center gap-2 font-semibold mb-4 ${txInfo.receipt.status === 1 ? 'text-green-600' : 'text-red-600'}`}>
                            {txInfo.receipt.status === 1 ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                            Status: {txInfo.receipt.status === 1 ? "Success" : "Failed"}
                        </div>
                        {txInfo.decodedLogs.length > 0 && (
                            <div>
                                <h3 className="font-semibold mb-2">Token Transfers:</h3>
                                <div className="space-y-3">
                                {txInfo.decodedLogs.map((log, index) => (
                                    <div key={index} className="p-3 border rounded-lg bg-gray-50 text-sm">
                                        <p><strong>Token:</strong> {log.tokenDetails.symbol}</p>
                                        <p className="font-mono break-all"><strong>From:</strong> {log.args.from}</p>
                                        <p className="font-mono break-all"><strong>To:</strong> {log.args.to}</p>
                                        <p><strong>Amount:</strong> {formatUnits(log.args.value, log.tokenDetails.decimals)}</p>
                                    </div>
                                ))}
                                </div>
                            </div>
                        )}
                    </Card>
                )}
            </main>
        </div>
    );
}