const express = require("express");
const router = express.Router();
const { signup, login } = require("../controllers/authController");
const { signupValidationRule, loginValidationRule } = require("../validationRules/authRules");
const { loginRateLimiter } = require("../middlewares/rateLimiter");


router.post("/signup", signupValidationRule, signup);

router.post("/login", loginRateLimiter, loginValidationRule, login);


module.exports = router;


