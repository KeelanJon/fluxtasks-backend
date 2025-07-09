// server.js
const express = require("express")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const { Pool } = require("pg")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 5000
const APIKey = process.env.API_KEY || ""

// Middleware
app.use(cors())
app.use(express.json())

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || "your_username",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "todoapp",
  password: process.env.DB_PASSWORD || "your_password",
  port: process.env.DB_PORT || 5432,
})

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error("Error acquiring client:", err.stack)
    return
  }
  console.log("Connected to PostgreSQL database")
  release()
})

// Login Endpoints

app.post("/api/login", (req, res) => {
  const { username, password } = req.body

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    })
    res.json({ success: true })
  } else {
    res.status(401).json({ error: "Invalid credentials" })
  }
})

// API Routes

// GET /api/tasks - Get all tasks
app.get("/api/tasks", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM tasks ORDER BY created_at DESC"
    )
    res.json(result.rows)
  } catch (err) {
    console.error("Error fetching tasks:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/tasks - Create a new task
app.post("/api/tasks", async (req, res) => {
  try {
    const { text } = req.body

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Task text is required" })
    }

    const result = await pool.query(
      "INSERT INTO tasks (text, completed) VALUES ($1, $2) RETURNING *",
      [text.trim(), false]
    )

    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error("Error creating task:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// PUT /api/tasks/:id - Update a task (toggle completion or edit text)
app.put("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { text, completed } = req.body

    // Build dynamic query based on provided fields
    let query = "UPDATE tasks SET "
    let values = []
    let valueIndex = 1

    if (text !== undefined) {
      query += `text = $${valueIndex}, `
      values.push(text.trim())
      valueIndex++
    }

    if (completed !== undefined) {
      query += `completed = $${valueIndex}, `
      values.push(completed)
      valueIndex++
    }

    // Remove trailing comma and space
    query = query.slice(0, -2)
    query += ` WHERE id = $${valueIndex} RETURNING *`
    values.push(id)

    const result = await pool.query(query, values)

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error("Error updating task:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// DELETE /api/tasks/:id - Delete a task
app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      "DELETE FROM tasks WHERE id = $1 RETURNING *",
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" })
    }

    res.json({ message: "Task deleted successfully", task: result.rows[0] })
  } catch (err) {
    console.error("Error deleting task:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...")
  await pool.end()
  process.exit(0)
})
