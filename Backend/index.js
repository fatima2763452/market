require("dotenv").config();
const WatchlistQuoteRoute = require("./Routes/WatchlistQuoteRoute");
const InstrumentBulkImportRoute = require("./Routes/InstrumentBulkImportRoute");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRouter = require("./Routes/AuthRoute");
const UpstoxAuthRouter = require("./Routes/UpstoxAuthRoute");
const quoteRouter = require("./Routes/upstox");
const instrumentStockNameRoute = require('./Routes/instrumentStockNameRoute');
const optionChainRoute = require("./Routes/optionChainRoute");
const chartRoute = require('./Routes/ChartRoute');

const app = express();
const PORT = process.env.PORT;
const MONGO_URL = process.env.MONGO_URL;

// ------------------ MIDDLEWARE -------------------
app.use(bodyParser.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// ------------------ ROUTES -----------------------

app.use("/api/auth", authRouter);
app.use("/", UpstoxAuthRouter); 
app.use("/upstox", quoteRouter);
app.use('/api', instrumentStockNameRoute);
app.use('/api', InstrumentBulkImportRoute);
app.use('/api', WatchlistQuoteRoute);
app.use("/api", optionChainRoute);
app.use('/api', chartRoute)


// ------------------ SERVER START ---------------------
mongoose
  .connect(MONGO_URL)
  .then(() => {
    console.log("MongoDB is connected successfully");
    app.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed", err);
  });
