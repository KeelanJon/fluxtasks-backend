// server.js
const express = require("express")
const cors = require("cors")
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

// Login & Signup Endpoints

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, error: "Username and password required" })
  }

  try {
    // Fetch user from DB by email/username
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      username,
    ])

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" })
    }

    const user = result.rows[0]

    // Compare entered password with stored hash
    const match = await bcrypt.compare(password, user.password)

    if (!match) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" })
    }

    // Optional: create session, JWT, or cookie here
    res.json({ success: true, userId: user.id, email: user.email })
  } catch (err) {
    console.error("Login error:", err)
    res.status(500).json({ success: false, error: "Internal server error" })
  }
})

app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, error: "Email and password are required" })
  }

  try {
    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [email, hashedPassword]
    )

    res.status(201).json({
      success: true,
      user: result.rows[0],
    })
  } catch (err) {
    console.error("Signup error:", err)

    // Optionally check for duplicate email errors (PostgreSQL code 23505)
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ success: false, error: "Email already exists" })
    }

    res.status(500).json({ success: false, error: "Internal server error" })
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
