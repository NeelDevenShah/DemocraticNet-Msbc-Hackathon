const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const User = require("./models/User");
const ModifiedNews = require("./models/Modified");
const UnModifiedNews = require("./models/UnModified");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      "mongodb://0.0.0.0:27017/News-Ministry-System",
      {
        dbName: "News-Ministry-System",
      }
    );
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const seedDB = async () => {
  await connectDB();

  // Clear existing
  await User.deleteMany({});
  await ModifiedNews.deleteMany({});
  await UnModifiedNews.deleteMany({});
  console.log("Database cleared!");

  // Create salt & passwords
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash("password123", salt);

  // Seed Users
  await User.create({
    fullName: "Neel Shah",
    email: "neel@democraticnet.org",
    password: hashedPassword,
    ministryId: 4, // Information & Broadcasting
    myNewsCount: 2,
    myReportedNews: [],
  });

  await User.create({
    fullName: "Pankil Soni",
    email: "pankil@democraticnet.org",
    password: hashedPassword,
    ministryId: 12, // Defence
    myNewsCount: 1,
    myReportedNews: [],
  });

  await User.create({
    fullName: "Sneh Shah",
    email: "sneh@democraticnet.org",
    password: hashedPassword,
    ministryId: 30, // Finance
    myNewsCount: 0,
    myReportedNews: [],
  });

  console.log("Users seeded successfully!");

  // Load and parse data.json
  const dataPath = path.join(__dirname, "data.json");
  if (!fs.existsSync(dataPath)) {
    console.error("data.json not found in backend directory!");
    process.exit(1);
  }

  const rawData = fs.readFileSync(dataPath, "utf8");
  const newsData = JSON.parse(rawData);

  const articlesToInsert = [];
  const unmodifiedToInsert = [];
  const titlesSet = new Set();

  Object.values(newsData).forEach((category) => {
    category.forEach((item) => {
      item.subclusters.forEach((subcluster) => {
        // Determine sentiment from distribution
        let sentiment = "NEUTRAL";
        if (subcluster.sentiment_distribution) {
          const dist = subcluster.sentiment_distribution;
          let maxCount = -1;
          Object.entries(dist).forEach(([s, count]) => {
            if (count > maxCount) {
              maxCount = count;
              sentiment = s.toUpperCase();
            }
          });
        }

        // Add each title in the subcluster to the DB
        subcluster.titles.forEach((titleObj) => {
          if (!titlesSet.has(titleObj.title)) {
            titlesSet.add(titleObj.title);

            // Cycle validations for demonstration
            const validations = ["REAL", "FAKE", "UNVERIFIED"];
            const validation = validations[articlesToInsert.length % validations.length];
            const AIValidation = validations[(articlesToInsert.length + 1) % validations.length];

            // Assign a random ministry
            const ministryIds = [0, 3, 4, 6, 12, 30, 40, 60];
            const ministry = [ministryIds[articlesToInsert.length % ministryIds.length]];

            const article = {
              title: titleObj.title,
              author: "Associated Press",
              source: titleObj.source || "Global News",
              description: `Verification report regarding the article: "${titleObj.title}". Clustered news analysis has classified this item.`,
              ministry: ministry,
              sentiment: sentiment,
              sentimentScore: sentiment === "POSITIVE" ? 0.8 : (sentiment === "NEGATIVE" ? -0.8 : 0.0),
              validation: validation,
              AIValidation: AIValidation,
              tag: "international",
              url: "https://news.google.com",
              imageurl: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80",
              publishedAt: new Date(Date.now() - (articlesToInsert.length * 60 * 60 * 1000)), // dynamic spread times
            };

            articlesToInsert.push(article);
            unmodifiedToInsert.push({ ...article });
          }
        });
      });
    });
  });

  console.log(`Prepared ${articlesToInsert.length} articles to seed.`);

  await ModifiedNews.insertMany(articlesToInsert);
  await UnModifiedNews.insertMany(unmodifiedToInsert);
  console.log("Mock news articles from data.json seeded successfully!");

  mongoose.connection.close();
  console.log("Database connection closed.");
};

seedDB();
