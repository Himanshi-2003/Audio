import { Router } from "express";
import mongoose from "mongoose";
import Project from "../models/Project.js";

const router = Router();
const validId = id => mongoose.isValidObjectId(id);
const cleanName = value => String(value ?? "").trim().slice(0, 160) || "Untitled project";

router.get("/", async (_req, res, next) => {
  try {
    const projects = await Project.find({}, "name createdAt updatedAt").sort({ updatedAt: -1 }).lean();
    res.json({ projects });
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const project = await Project.create({ name: cleanName(req.body?.name) });
    res.status(201).json({ project });
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid project ID." });
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    res.json({ project });
  } catch (e) { next(e); }
});

router.patch("/:id", async (req, res, next) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid project ID." });
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id, { $set: { name: cleanName(req.body?.name) } },
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ error: "Project not found." });
    res.json({ project });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid project ID." });
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.post("/:id/subtitles", async (req, res, next) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid project ID." });
  const { start, end, text } = req.body ?? {};
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || !String(text ?? "").trim()) {
    return res.status(400).json({ error: "Provide non-empty text and valid start/end times (end must be after start)." });
  }
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    project.subtitles.push({ start, end, text: String(text).trim() });
    await project.save();
    res.status(201).json({ project, subtitle: project.subtitles.at(-1) });
  } catch (e) { next(e); }
});

router.put("/:id/subtitles", async (req, res, next) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid project ID." });
  const incoming = req.body?.subtitles;
  if (!Array.isArray(incoming)) return res.status(400).json({ error: "subtitles must be an array." });
  const subtitles = [];
  for (const s of incoming) {
    const start = Number(s.start), end = Number(s.end), text = String(s.text ?? "").trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || !text) {
      return res.status(400).json({ error: "Each subtitle needs text and valid start/end times." });
    }
    subtitles.push({ start, end, text });
  }
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    project.subtitles = subtitles;
    await project.save();
    res.json({ project });
  } catch (e) { next(e); }
});

router.put("/:id/subtitles/:subtitleId", async (req, res, next) => {
  if (!validId(req.params.id) || !validId(req.params.subtitleId)) return res.status(400).json({ error: "Invalid ID." });
  const { start, end, text } = req.body ?? {};
  if (start !== undefined && (!Number.isFinite(start) || start < 0)) return res.status(400).json({ error: "Invalid start time." });
  if (end !== undefined && (!Number.isFinite(end) || end < 0)) return res.status(400).json({ error: "Invalid end time." });
  if (text !== undefined && !String(text).trim()) return res.status(400).json({ error: "Text cannot be empty." });
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    const subtitle = project.subtitles.id(req.params.subtitleId);
    if (!subtitle) return res.status(404).json({ error: "Subtitle not found." });
    if (start !== undefined) subtitle.start = start;
    if (end !== undefined) subtitle.end = end;
    if (text !== undefined) subtitle.text = String(text).trim();
    if (subtitle.end <= subtitle.start) return res.status(400).json({ error: "End time must be after start time." });
    await project.save();
    res.json({ project, subtitle });
  } catch (e) { next(e); }
});

router.delete("/:id/subtitles/:subtitleId", async (req, res, next) => {
  if (!validId(req.params.id) || !validId(req.params.subtitleId)) return res.status(400).json({ error: "Invalid ID." });
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    const subtitle = project.subtitles.id(req.params.subtitleId);
    if (!subtitle) return res.status(404).json({ error: "Subtitle not found." });
    subtitle.deleteOne();
    await project.save();
    res.json({ project });
  } catch (e) { next(e); }
});

export default router;