const Parent = require("../models/Parent");
const Child = require("../models/Child");
const ScanLog = require("../models/ScanLog");

const getStats = async (req, res, next) => {
  try {
    const [totalParents, totalChildren, totalScans] = await Promise.all([
      Parent.countDocuments(),
      Child.countDocuments(),
      ScanLog.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        parents: totalParents,
        children: totalChildren,
        scans: totalScans,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStats };