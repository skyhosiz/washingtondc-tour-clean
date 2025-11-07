const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, index: true }, // sha256(url+lang+contentHash)
    url: String,
    lang: { type: String, default: "th" },
    questions: [
      {
        stem: String,
        choices: [String],      // 4 ตัวเลือก
        answerIndex: Number,    // 0..3
        explain: String
      }
    ]
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("QuizCache", quizSchema);
