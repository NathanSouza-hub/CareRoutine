const cors = require("cors");
const express = require("express");
const pool = require("./config/database");
const createVitalsController = require("./controllers/vitals-controller");
const vitalsRepository = require("./repositories/vitals-repository");
const createVitalsRouter = require("./routes/vitals-routes");
const createVitalsService = require("./services/vitals-service");
const createMedicationsController = require("./controllers/medications-controller");
const medicationsRepository = require("./repositories/medications-repository");
const createMedicationsRouter = require("./routes/medications-routes");
const createMedicationsService = require("./services/medications-service");
const createRoutinesController = require("./controllers/routines-controller");
const routinesRepository = require("./repositories/routines-repository");
const createRoutinesRouter = require("./routes/routines-routes");
const createRoutinesService = require("./services/routines-service");
const createPatientsController = require("./controllers/patients-controller");
const patientsRepository = require("./repositories/patients-repository");
const createPatientsRouter = require("./routes/patients-routes");
const createPatientsService = require("./services/patients-service");

const app = express();

app.use(cors());
app.use(express.json());

const vitalsService = createVitalsService(vitalsRepository);
const vitalsController = createVitalsController(vitalsService);

app.use("/api/vitals", createVitalsRouter(vitalsController));

const medicationsService = createMedicationsService(medicationsRepository);
const medicationsController = createMedicationsController(medicationsService);
app.use("/api/medications", createMedicationsRouter(medicationsController));

const routinesService = createRoutinesService(routinesRepository);
const routinesController = createRoutinesController(routinesService);
app.use("/api/routines", createRoutinesRouter(routinesController));

const patientsService = createPatientsService(patientsRepository);
const patientsController = createPatientsController(patientsService);
app.use("/api/patients", createPatientsRouter(patientsController));

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

app.use((error, request, response, next) => {
  console.error("Erro inesperado na API:", error.message);
  response.status(500).json({
    error: "Erro interno do servidor",
  });
});

module.exports = app;
