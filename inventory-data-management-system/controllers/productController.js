const mongoose = require("mongoose");
const Product = require("../models/Product");

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// POST /api/products - create a product
exports.createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

// GET /api/products - filtering, sorting and pagination
exports.getProducts = async (req, res, next) => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      sort = "-createdAt",
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};
    if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, "i");
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { name: new RegExp(safeSearch, "i") },
        { sku: new RegExp(safeSearch, "i") },
        { supplier: new RegExp(safeSearch, "i") }
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
      if (Object.values(filter.price).some((value) => !Number.isFinite(value))) {
        return res.status(400).json({ success: false, message: "Price filters must be valid numbers" });
      }
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const sortBy = {};
    const sortFields = String(sort).split(",");
    for (const field of sortFields) {
      const trimmed = field.trim();
      if (!trimmed) continue;
      sortBy[trimmed.replace(/^-/, "")] = trimmed.startsWith("-") ? -1 : 1;
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(Object.keys(sortBy).length ? sortBy : { createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      Product.countDocuments(filter)
    ]);

    res.json({
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / pageSize),
      count: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/:id - get one product
exports.getProductById = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json(product);
  } catch (error) {
    next(error);
  }
};

// PUT /api/products/:id - update product details
exports.updateProduct = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    const allowedFields = ["name", "sku", "category", "price", "quantity", "reorderLevel", "supplier"];
    const updates = {};
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
    }
    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json(product);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/products/:id - delete a product
exports.deleteProduct = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ message: "Product deleted", id: product._id });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/low-stock - products at or below reorder level
exports.getLowStockProducts = async (req, res, next) => {
  try {
    const lowStockItems = await Product.find({
      $expr: { $lte: ["$quantity", "$reorderLevel"] }
    }).sort({ quantity: 1 });
    res.json({ count: lowStockItems.length, lowStockItems });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/summary - category-wise aggregation
exports.getInventorySummary = async (req, res, next) => {
  try {
    const summary = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalStockValue: { $sum: { $multiply: ["$price", "$quantity"] } },
          avgPrice: { $avg: "$price" }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          category: "$_id",
          totalItems: 1,
          totalQuantity: 1,
          totalStockValue: { $round: ["$totalStockValue", 2] },
          avgPrice: { $round: ["$avgPrice", 2] }
        }
      }
    ]);

    res.json({ categories: summary.length, summary });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/products/:id/stock - increase or decrease stock
exports.adjustStock = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    const change = Number(req.body.change);
    if (!Number.isInteger(change) || change === 0) {
      return res.status(400).json({ success: false, message: "change must be a non-zero whole number" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    if (product.quantity + change < 0) {
      return res.status(400).json({ success: false, message: "Insufficient stock: quantity cannot become negative" });
    }

    product.quantity += change;
    await product.save();
    res.json({ message: "Stock updated", product });
  } catch (error) {
    next(error);
  }
};

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
