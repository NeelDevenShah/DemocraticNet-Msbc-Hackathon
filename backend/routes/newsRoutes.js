const express = require("express");
const router = express.Router();
const { fetchAllNews, findNews, getAnalysisJson, getAnalysisJson2 } = require("../controllers/newsControllers.js");

router.get("/", fetchAllNews);
router.post("/find", findNews);
router.get("/get-analysis-json", getAnalysisJson);
router.get("/get-analysis-json2", getAnalysisJson2);
module.exports = router;
