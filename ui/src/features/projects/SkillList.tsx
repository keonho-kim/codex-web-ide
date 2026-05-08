import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { mutedClass, transparentListButtonClass } from "../../components/uiClasses";
import { api } from "../../lib/api";
import type { ComposerMention } from "../../lib/types";

type SkillMention = Extract<ComposerMention, { type: "skill" }>;

export function SkillList({ sessionId }: { sessionId?: string }) {
  const skills = useQuery({
    queryKey: ["mentions", "skills", sessionId, ""],
    queryFn: () => api<SkillMention[]>(`/api/sessions/${sessionId}/mentions/skills?q=`),
    enabled: Boolean(sessionId),
  });

  return (
    <nav className="grid gap-1">
      {skills.data?.slice(0, 8).map((skill) => (
        <div className={transparentListButtonClass} key={skill.id} title={`$${skill.name}`}>
          <Sparkles size={15} />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{skill.name}</span>
        </div>
      ))}
      {!sessionId ? <p className={mutedClass}>Create a session to load skills.</p> : null}
      {sessionId && skills.data?.length === 0 ? <p className={mutedClass}>No skills found.</p> : null}
    </nav>
  );
}
