// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. DATABASE CONNECTION ---
// No changes here, your existing connection is perfect.
mongoose.connect("mongodb+srv://sheltondsouza4923:jCT08XXHIYQ5OZQt@cluster0.phklsbp.mongodb.net/Web3", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('MongoDB connected successfully.'));


// --- 2. MONGOOSE SCHEMAS & MODELS ---

// Existing Wallet Schema - no changes
const walletSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  address: String,
  privateKey: String,
  mnemonic: String,
});
const Wallet = mongoose.model("Wallet", walletSchema);

// NEW: Transaction Schema
// This defines the structure for storing transaction history.
const transactionSchema = new mongoose.Schema({
  walletName: { type: String, required: true, index: true },
  txHash: { type: String, required: true, unique: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  amount: { type: String, required: true },
  tokenSymbol: { type: String, required: true },
}, { timestamps: true });
const Transaction = mongoose.model('Transaction', transactionSchema);

// --- 3. API ENDPOINTS ---

// Existing Wallet Endpoints - with one small change to your post route
app.post("/api/wallet/save", async (req, res) => { // Changed route to match frontend
  // Your original code had /api/wallet, but your frontend used /api/wallet/save
  // I've standardized it to /api/wallet/save to match your frontend code.
  const { name, address, privateKey, mnemonic } = req.body;

  if (!name || !address || !privateKey) { // Removed mnemonic as a requirement, as frontend doesn't send it.
    return res.status(400).json({ message: "Missing required wallet fields" });
  }

  try {
    const wallet = new Wallet({ name, address, privateKey, mnemonic });
    await wallet.save();
    res.status(201).json({ message: "Wallet saved successfully" });
  } catch (err) {
    if (err.code === 11000) { // Handles duplicate wallet name error
        return res.status(409).json({ message: "A wallet with this name already exists." });
    }
    console.error("Error saving wallet:", err);
    res.status(500).json({ message: "Failed to save wallet" });
  }
});

// Existing wallet fetch endpoint - no changes
app.get("/api/wallet/:name", async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ name: req.params.name });
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }
    res.json(wallet);
  } catch (err) {
    console.error("Error fetching wallet:", err);
    res.status(500).json({ error: "Error fetching wallet" });
  }
});


// --- NEW: Transaction History Endpoints ---

// Endpoint to save a new transaction record
app.post('/api/transactions/save', async (req, res) => {
  try {
    const { walletName, txHash, from, to, amount, tokenSymbol } = req.body;

    // Basic validation
    if (!walletName || !txHash || !from || !to || !amount || !tokenSymbol) {
      return res.status(400).json({ message: "Missing required transaction fields" });
    }

    // Create a new transaction document using the model
    const newTransaction = new Transaction({
        walletName,
        txHash,
        from,
        to,
        amount,
        tokenSymbol,
    });

    await newTransaction.save();
    res.status(201).json({ message: "Transaction history saved successfully!" });
  } catch (error) {
    // Handle cases where the transaction hash might already exist
    if (error.code === 11000) {
        return res.status(409).json({ message: 'This transaction has already been saved.' });
    }
    console.error("Error saving transaction:", error);
    res.status(500).json({ message: "Server error while saving transaction" });
  }
});

// Endpoint to fetch all transaction history for a given wallet name
app.get('/api/transactions/:walletName', async (req, res) => {
    try {
        const { walletName } = req.params;
        // Find all transactions matching the walletName and sort them by creation date, newest first.
        const transactions = await Transaction.find({ walletName }).sort({ createdAt: -1 });
        res.status(200).json(transactions);
    } catch (error) {
        console.error("Error fetching transaction history:", error);
        res.status(500).json({ message: "Server error while fetching history" });
    }
});
// Global ledger endpoint (fetches all transactions)
app.get('/api/ledger', async (req, res) => {
    try {
        const transactions = await Transaction.find().sort({ createdAt: -1 });
        res.status(200).json(transactions);
    } catch (error) {
        console.error("Error fetching global ledger:", error);
        res.status(500).json({ message: "Server error while fetching ledger" });
    }
});


// --- 4. SERVER START ---
// No changes here
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});