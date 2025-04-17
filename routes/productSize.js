const { ProductSize } = require("../models/productSize");
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const productSizeList = await ProductSize.find();
        if (!productSizeList) {
            return res.status(500).json({ success: false });
        }
        return res.status(200).json(productSizeList);
    } catch (error) {
        console.error("GET / error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid ID format", success: false });
        }
        const item = await ProductSize.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: "The item with the given ID was not found." });
        }
        return res.status(200).send(item);
    } catch (error) {
        console.error("GET /:id error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post("/create", async (req, res) => {
    try {
        if (!req.body.size) {
            return res.status(400).json({ message: "Size is required", success: false });
        }
        let productsize = new ProductSize({
            size: req.body.size,
        });
        productsize = await productsize.save();
        return res.status(201).json(productsize);
    } catch (error) {
        console.error("POST /create error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid ID format", success: false });
        }
        const deletedItem = await ProductSize.findByIdAndDelete(req.params.id);
        if (!deletedItem) {
            return res.status(404).json({
                message: "Item not found!",
                success: false,
            });
        }
        return res.status(200).json({
            success: true,
            message: "Item Deleted!",
        });
    } catch (error) {
        console.error("DELETE /:id error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid ID format", success: false });
        }
        const item = await ProductSize.findByIdAndUpdate(
            req.params.id,
            { size: req.body.size },
            { new: true }
        );
        if (!item) {
            return res.status(404).json({
                message: "Item not found!",
                success: false,
            });
        }
        return res.status(200).json(item);
    } catch (error) {
        console.error("PUT /:id error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;