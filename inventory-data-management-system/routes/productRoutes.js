const express = require("express");
const router = express.Router();
const controller = require("../controllers/productController");

// Keep report routes before /:id so they are not treated as product IDs.
router.get("/low-stock", controller.getLowStockProducts);
router.get("/summary", controller.getInventorySummary);

router.route("/")
  .post(controller.createProduct)
  .get(controller.getProducts);

router.route("/:id")
  .get(controller.getProductById)
  .put(controller.updateProduct)
  .delete(controller.deleteProduct);

router.patch("/:id/stock", controller.adjustStock);

module.exports = router;
