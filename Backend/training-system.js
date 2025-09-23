// training-system.js
const mongoose = require("mongoose");

// ==================================================
// Schema & Model
// ==================================================
const trainingExampleSchema = new mongoose.Schema({
  input: { type: String, required: true },
  output: { type: String, required: true },
  tone: { type: String, default: "neutral" },
  category: { type: String, default: "general" },
  source: { type: String, enum: ["manual", "ai"], default: "manual" },
  createdAt: { type: Date, default: Date.now }
});

const TrainingExample =
  mongoose.models.TrainingExample ||
  mongoose.model("TrainingExample", trainingExampleSchema);

// ==================================================
// Training System Class
// ==================================================
class TrainingSystem {
  constructor() {
    this.examples = [];
    this.optimizedPrompt = "You are a professional editor that makes text natural, clear, and human.";
  }

  // ✅ Load examples from DB
  async loadExamples() {
    try {
      this.examples = await TrainingExample.find();
      console.log(`📥 Loaded ${this.examples.length} training examples`);
    } catch (err) {
      console.error("❌ Failed to load training examples:", err.message);
    }
  }

  // ✅ Save AI-generated example
  async saveAIExample(input, output, tone = "neutral", category = "general") {
    try {
      const example = new TrainingExample({
        input,
        output,
        tone,
        category,
        source: "ai"
      });
      await example.save();
      console.log("🧠 AI-generated example saved:", example._id);
      return example;
    } catch (err) {
      console.error("❌ Failed to save AI example:", err.message);
      return null;
    }
  }

  // ✅ Optimize system prompt dynamically
  async optimizeSystemPrompt() {
    if (!this.examples.length) {
      this.optimizedPrompt = "You are a professional editor.";
      return this.optimizedPrompt;
    }

    // Collect distinct tones & categories
    const tones = [...new Set(this.examples.map(e => e.tone))];
    const categories = [...new Set(this.examples.map(e => e.category))];

    this.optimizedPrompt = `
You are an AI editor trained on real-world data.
Rewrite text so it feels natural, human, and context-appropriate.

Supported tones: ${tones.join(", ")}.
Supported categories: ${categories.join(", ")}.

Always keep meaning intact while improving readability.
`;

    console.log("🔧 Optimized system prompt updated.");
    return this.optimizedPrompt;
  }

  // ✅ Get examples summary
  getTrainingStats() {
    return {
      total: this.examples.length,
      tones: [...new Set(this.examples.map(e => e.tone))],
      categories: [...new Set(this.examples.map(e => e.category))],
      optimizedPrompt: this.optimizedPrompt
    };
  }
}

module.exports = new TrainingSystem();
