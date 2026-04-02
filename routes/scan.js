const express = require("express");
const router = express.Router();
const { scan } = require("../controllers/scanController");
const { scanParamValidationRules } = require("../validationRules/scanRules");
const { scanRateLimiter } = require("../middlewares/rateLimiter");


router.get("/:code",scanRateLimiter ,scanParamValidationRules, scan);


module.exports = router;