const ModifiedNews = require("../models/Modified");
const UnModifiedNews = require("../models/UnModified");
const fs = require("fs");
const path = require("path");

exports.fetchAllNews = async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const skip = parseInt(req.query.skip) || 0;
  const searchQuery = req.query.search || "";
  const { sentiment, validation } = req.query;

  const querySentimentList = sentiment
    ? sentiment.split(",")
    : ["POSITIVE", "NEGATIVE", "NEUTRAL"];
  const queryValidationList = validation
    ? validation.split(",")
    : ["REAL", "FAKE", "UNVERIFIED"];

  try {
    let news;

    if (searchQuery) {
      news = await ModifiedNews.find({
        sentiment: { $in: querySentimentList },
        validation: { $in: queryValidationList },
        $text: { $search: searchQuery },
      })
        .sort({ score: { $meta: "textScore" }, imageurl: -1, publishedAt: -1 }) // Sort by relevance score and then by imageurl
        .limit(limit)
        .skip(skip);
    } else {
      news = await ModifiedNews.find({
        sentiment: { $in: querySentimentList },
        validation: { $in: queryValidationList },
      })
        .sort({ imageurl: -1, publishedAt: -1 })
        .limit(limit)
        .skip(skip);
    }

    return res.send(news);
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.updateNews = async (req, res) => {
  const { newsId } = req.params;
  if (!newsId) {
    return res.status(400).send("News Id is required");
  }
  const { validation } = req.body;
  if (!validation || (validation !== "REAL" && validation !== "FAKE")) {
    return res.status(400).send("Invaalid Validation");
  }

  const user = req.user;
  const ministryId = user.ministryId;

  try {
    const updatedNews = await ModifiedNews.findByIdAndUpdate(
      newsId,
      {
        validation,
        reportedby: ministryId,
      },
      { new: true }
    );
    return res.send(updatedNews);
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.findNews = async (req, res) => {
  let { titles } = req.body;

  if (!titles) {
    return res.status(400).send("Titles is required");
  }

  if (!Array.isArray(titles)) {
    return res.status(400).send("Titles should be an array");
  }

  console.log(titles);

  try {
    let news1;
    let news2;
    news1 = await ModifiedNews.find({
      title: { $in: titles },
    });

    news2 = await UnModifiedNews.find({
      title: { $in: titles },
    });

    let news = news1.concat(news2);
    return res.send(news);
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.getAnalysisJson = async (req, res) => {
  try {
    const dataPath = path.join(__dirname, "../data.json");
    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, "utf8");
      return res.json(JSON.parse(rawData));
    } else {
      return res.json({ ORG: [], PERSON: [], GPE: [] });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};

exports.getAnalysisJson2 = async (req, res) => {
  try {
    const totalNewsCount = await ModifiedNews.countDocuments();
    
    // Aggregate top sources
    const topSourcesAgg = await ModifiedNews.aggregate([
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    const top_sources = {};
    topSourcesAgg.forEach(item => {
      if (item._id) {
        top_sources[item._id] = item.count;
      }
    });

    // Aggregate top ministries
    const topMinistriesAgg = await ModifiedNews.aggregate([
      { $unwind: "$ministry" },
      { $group: { _id: "$ministry", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const top_ministries = {};
    topMinistriesAgg.forEach(item => {
      if (item._id !== null && item._id !== undefined) {
        top_ministries[item._id] = item.count;
      }
    });

    // Aggregate sentiment
    const sentimentAgg = await ModifiedNews.aggregate([
      { $group: { _id: "$sentiment", count: { $sum: 1 } } }
    ]);
    const sentiment_analysis = { positive: 0, negative: 0, neutral: 0 };
    sentimentAgg.forEach(item => {
      if (item._id) {
        const key = item._id.toLowerCase();
        if (key in sentiment_analysis) {
          sentiment_analysis[key] = item.count;
        }
      }
    });

    return res.json({
      length_data: totalNewsCount,
      top_sources,
      top_ministries,
      sentiment_analysis
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
};
