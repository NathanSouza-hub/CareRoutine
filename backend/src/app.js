const cors = require("cors");
const express = require("express");
const pool = require("./config/database");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (request, response) => {
  response.status(200).json({
    status: "ok",
    service: "CareRoutine API",
  });
});

app.get("/health/database", async (request, response) => {
  try {
    const result = await pool.query(
      "SELECT CURRENT_DATABASE() AS database, CURRENT_TIMESTAMP AS checked_at",
    );

    response.status(200).json({
      status: "ok",
      database: result.rows[0].database,
      checkedAt: result.rows[0].checked_at,
    });
  } catch (error) {
    console.error("Falha ao verificar o banco de dados:", error.message);
    response.status(503).json({
      status: "error",
      message: "Banco de dados indisponível",
    });
  }
});

module.exports = app;
