const Child = require("../models/Child");
const Parent = require("../models/Parent");
const { handleValidation } = require("../utils/validators");

const addChild = async (req, res, next) => {
    try {
        handleValidation(req);

        const allowed = ["name", "age", "emergencyMessage", "location"];
        const sanitizedBody = {};

        for (let key of allowed) {
            if (req.body[key]) sanitizedBody[key] = req.body[key];
        }

        const child = await Child.create({
            ...sanitizedBody,
            parent: req.user._id
        });

        await Parent.findByIdAndUpdate(req.user._id, {
            $push: { children: child._id }
        });

        res.json(child);
    } catch (err) {
        next(err);
    }
}

const getChildData =  async (req, res, next) => {
    try {
        handleValidation(req);

        const child = await Child.findById(req.params.id);
        if (!child) {
            const err = new Error("Child not found");
            err.statusCode = 404;
            throw err;
        }

        if (child.parent.toString() !== req.user._id.toString()) {
            const err = new Error("Forbidden");
            err.statusCode = 403;
            throw err;
        }

        res.json(child);
    } catch (err) {
        next(err);
    }
}

const updateChildData = async (req, res, next) => {
    try {
        handleValidation(req);

        const child = await Child.findById(req.params.id);
        if (!child) {
            const err = new Error("Child not found");
            err.statusCode = 400;
            throw err;
        }

        if (child.parent.toString() !== req.user._id.toString()) {
            const err = new Error("Forbidden");
            err.statusCode = 403;
            throw err;
        }

        const allowed = ["name", "age", "emergencyMessage", "location"];
        const updates = {};

        for (let key of allowed) {
            if (req.body[key]) updates[key] = req.body[key];
        }

        const updated = await Child.findByIdAndUpdate(req.params.id, updates, { new: true });

        res.json(updated);
    } catch (err) {
        next(err);
    }
}

const deleteChildData = async (req, res, next) => {
    try {
        handleValidation(req);

        const child = await Child.findById(req.params.id);
        if (!child) {
            const err = new Error("Child not found");
            err.statusCode = 400;
            throw err;
        }

        if (child.parent.toString() !== req.user._id.toString()) {
            const err = new Error("Forbidden");
            err.statusCode = 403;
            throw err;
        }

        await Child.findByIdAndDelete(req.params.id);  // we will use transaction in future
        await Parent.findByIdAndUpdate(req.user._id, {
            $pull: { children: child._id }
        });

        res.json({ message: "Deleted successfully" });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    addChild,
    getChildData,
    updateChildData,
    deleteChildData
}