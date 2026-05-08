import type { Express } from "express";
import { gitBranchSchema, gitCommitSchema, gitPathSchema } from "../shared/schemas";
import { type AppServices, withSession, zodFileList } from "./context";

export function registerGitRoutes(app: Express, { git, sessions }: AppServices) {
  app.get("/api/sessions/:id/git/state", withSession(sessions, async (_req, res, session) => {
    res.json(await git.state(session.cwd));
  }));
  app.get("/api/sessions/:id/git/status", withSession(sessions, async (_req, res, session) => {
    res.json(await git.status(session.cwd));
  }));
  app.get("/api/sessions/:id/git/diff", withSession(sessions, async (req, res, session) => {
    const query = gitPathSchema.parse(req.query);
    res.json({ diff: await git.diff(session.cwd, query.path, false) });
  }));
  app.get("/api/sessions/:id/git/diff/staged", withSession(sessions, async (req, res, session) => {
    const query = gitPathSchema.parse(req.query);
    res.json({ diff: await git.diff(session.cwd, query.path, true) });
  }));
  app.post("/api/sessions/:id/git/stage", withSession(sessions, async (req, res, session) => {
    await git.stage(session.cwd, zodFileList(req.body));
    res.json(await git.state(session.cwd));
  }));
  app.post("/api/sessions/:id/git/unstage", withSession(sessions, async (req, res, session) => {
    await git.unstage(session.cwd, zodFileList(req.body));
    res.json(await git.state(session.cwd));
  }));
  app.post("/api/sessions/:id/git/commit", withSession(sessions, async (req, res, session) => {
    await git.commit(session.cwd, gitCommitSchema.parse(req.body).message);
    res.json(await git.state(session.cwd));
  }));
  app.post("/api/sessions/:id/git/push", withSession(sessions, async (_req, res, session) => {
    await git.push(session.cwd);
    res.json(await git.state(session.cwd));
  }));
  app.post("/api/sessions/:id/git/pull", withSession(sessions, async (_req, res, session) => {
    await git.pull(session.cwd);
    res.json(await git.state(session.cwd));
  }));
  app.post("/api/sessions/:id/git/branch", withSession(sessions, async (_req, res, session) => {
    res.json(await git.branch(session.cwd));
  }));
  app.post("/api/sessions/:id/git/checkout", withSession(sessions, async (req, res, session) => {
    await git.checkout(session.cwd, gitBranchSchema.parse(req.body).branch);
    res.json(await git.state(session.cwd));
  }));
  app.post("/api/sessions/:id/git/create-and-checkout", withSession(sessions, async (req, res, session) => {
    await git.createAndCheckout(session.cwd, gitBranchSchema.parse(req.body).branch);
    res.json(await git.state(session.cwd));
  }));
}
