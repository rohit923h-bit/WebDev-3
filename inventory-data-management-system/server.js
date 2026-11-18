
require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");
const productRoutes = require("./routes/productRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Inventory and Data Management System API",
    endpoints: "/api/products"
  });
});

app.use("/api/products", productRoutes);

app.use(notFound);
app.use(errorHandler);

// Start local server only when running directly
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Unable to start server:", error.message);
      process.exit(1);
    });
}

module.exports = app;
