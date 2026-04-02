const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { handleValidation } = require("../utils/validators");
const Parent = require("../models/Parent");
const { sanitizeParent } = require("../utils/helpers");

const signup = async (req, res, next) => {
    try {
        handleValidation(req);

        const { email, password, emergencyNumber } = req.body;

        const existing = await Parent.findOne({ email });
        if (existing) {
            const err = new Error("Email already exists");
            err.statusCode = 400; // Bad Request
            throw err;
        }

        const hashed = await bcrypt.hash(password, 10);

        const parent = await Parent.create({
            email,
            password: hashed,
            emergencyNumber
        });

        const token = jwt.sign({ id: parent._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.json({ token, parent: sanitizeParent(parent) });
    } catch (err) {
        next(err);
    }
}

const login = async (req, res, next) => {
    try {
        handleValidation(req);

        const { email, password } = req.body;

        const parent = await Parent.findOne({ email });
        if (!parent) {
            const err = new Error("Invalid credentials");
            err.statusCode = 400;
            throw err;
        }


        const match = await bcrypt.compare(password, parent.password);
        if (!match) {
            const err = new Error("Invalid credentials");
            err.statusCode = 400; 
            throw err;
        }

        const token = jwt.sign({ id: parent._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.json({ token, parent: sanitizeParent(parent) });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    signup,
    login
}