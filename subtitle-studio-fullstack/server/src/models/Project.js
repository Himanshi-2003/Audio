import mongoose from "mongoose";

const subtitleSchema = new mongoose.Schema({
  start: { type: Number, required: true, min: 0 },
  end: { type: Number, required: true, min: 0 },
  text: { type: String, required: true, trim: true, maxlength: 10000 }
}, { timestamps: true });

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160, default: "Untitled project" },
  subtitles: { type: [subtitleSchema], default: [] }
}, { timestamps: true });

export default mongoose.model("Project", projectSchema);