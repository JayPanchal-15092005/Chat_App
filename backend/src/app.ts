import express from "express";
import cors from "cors";
import path from "path";
import { clerkMiddleware } from "@clerk/express";

import authRoutes from "./routes/authRoutes.ts";
import chatRoutes from "./routes/chatRoutes.ts";
import messageRoutes from "./routes/chatRoutes.ts";
import userRoutes from "./routes/userRoutes.ts";

const app = express();

app.use(express.json()); // parses incoming JSON request bodies and makes them available as req.body in your route handlers

app.get("/health", (req, res) => {
    res.json({ status: "OK", message: "server is up and running there is no issues in the server" });
});

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);

export default app;