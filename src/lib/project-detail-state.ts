export type ProjectWithSessions = {
  _count: { sessions: number };
  sessions: Array<{ id: string }>;
  items?: Array<{ session: { id: string } | null }>;
};

export function withoutProjectSession<T extends ProjectWithSessions>(
  project: T,
  sessionId: string,
): T {
  const sessions = project.sessions.filter((session) => session.id !== sessionId);

  if (sessions.length === project.sessions.length) {
    return project;
  }

  return {
    ...project,
    _count: {
      ...project._count,
      sessions: Math.max(0, project._count.sessions - 1),
    },
    sessions,
    ...(project.items
      ? {
          items: project.items.filter(
            (item) => item.session?.id !== sessionId,
          ),
        }
      : {}),
  } as T;
}
