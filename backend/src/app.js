
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (_, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// API Routes
app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.id) },
      include: { 
        transactions: true,
        quests: true
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/users", async (req, res) => {
  const { wallet, profile } = req.body;
  try {
    const user = await prisma.user.create({
      data: { wallet, profile },
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/users", async (_, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { transactions: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transaction routes
app.post("/api/transactions", async (req, res) => {
  const { userId, type, chain, amount, reward } = req.body;
  try {
    const transaction = await prisma.transaction.create({
      data: { userId, type, chain, amount, reward },
    });
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/transactions/:userId", async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: Number(req.params.userId) },
      orderBy: { timestamp: 'desc' }
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Quest routes
app.get("/api/quests/:userId", async (req, res) => {
  try {
    const quests = await prisma.quest.findMany({
      where: { userId: Number(req.params.userId) }
    });
    res.json(quests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/quests", async (req, res) => {
  const { userId, status, rewards } = req.body;
  try {
    const quest = await prisma.quest.create({
      data: { userId, status, rewards },
    });
    res.status(201).json(quest);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Mokuen backend running on port ${PORT}`);
});
