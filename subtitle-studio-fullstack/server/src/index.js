import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import projectsRouter from "./routes/projects.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") ?? "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => res.json({
  status: "ok",
  database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  timestamp: new Date().toISOString()
}));
app.use("/api/projects", projectsRouter);

const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientDist, "index.html"), err => { if (err) next(); });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.name === "ValidationError") return res.status(400).json({ error: err.message });
  res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Internal server error." : err.message });
});

try {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing. Copy server/.env.example to server/.env and configure it.");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log("MongoDB connected.");
} catch (err) {
  console.error("MongoDB connection failed:", err.message);
  console.error("Local MongoDB URI: mongodb://127.0.0.1:27017/subtitle_studio");
  console.error("For Atlas, use the full mongodb+srv:// URI copied from Atlas. Never use mongodb+srv://localhost.");
}
app.listen(PORT, () => console.log(`Subtitle Studio API listening on http://localhost:${PORT}`));