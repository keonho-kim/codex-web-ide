import type { ComposerMention } from "../../shared/types";
import { safeFsPath } from "../files/path";

export async function validateCodexMentions(sessionCwd: string, mentions: ComposerMention[]) {
  await Promise.all(mentions.map((mention) => (mention.type === "file" ? safeFsPath(sessionCwd, mention.path) : Promise.resolve())));
}
