const express = require("express");
const router = express.Router();
const {
    getParentData,
    updateParentData,
    deleteParentData,
    getParentScanLogs
} = require("../controllers/parentController");
const authMiddleware = require("../middlewares/authMiddleware");
const { parentValidationRule } = require("../validationRules/parentRules");


router.get("/me", authMiddleware, getParentData);

router.put("/me", authMiddleware, parentValidationRule, updateParentData);

router.delete("/me", authMiddleware, deleteParentData);

router.get("/scans", authMiddleware, getParentScanLogs);

module.exports = router;