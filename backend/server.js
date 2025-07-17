// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb+srv://sheltondsouza4923:jCT08XXHIYQ5OZQt@cluster0.phklsbp.mongodb.net/Web3", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const walletSchema = new mongoose.Schema({
  name: String,
  address: String,
  privateKey: String,
  mnemonic: String,
});

const Wallet = mongoose.model("Wallet", walletSchema);

app.post("/api/wallet", async (req, res) => {
  const { name, address, privateKey, mnemonic } = req.body;

  if (!name || !address || !privateKey || !mnemonic) {
    return res.status(400).json({ message: "Missing wallet fields" });
  }

  try {
    const wallet = new Wallet({ name, address, privateKey, mnemonic });
    await wallet.save();
    res.status(201).json({ message: "Wallet saved successfully" });
  } catch (err) {
    console.error("Error saving wallet:", err);
    res.status(500).json({ message: "Failed to save wallet" });
  }
});

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

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
