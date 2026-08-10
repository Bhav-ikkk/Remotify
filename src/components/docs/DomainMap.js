const MODELS = [
  { name: "Job", role: "Scraped role + AI fields", key: "unique applyUrl" },
  { name: "CandidateProfile", role: "Matching brain", key: "slug + children" },
  { name: "Application", role: "Apply CRM / queue", key: "status lifecycle" },
  { name: "ApplicationIdentity", role: "Form-fill facts", key: "worker payload" },
  { name: "Setting", role: "JSON knobs + secrets", key: "unique key" },
  { name: "SchedulerConfig", role: "Enable / lock / UTC hours", key: "name=default" },
  { name: "RunHistory", role: "Per-run telemetry", key: "metrics + errors" },
];

export function DomainMap() {
  return (
    <div className="docs-domain" aria-label="Prisma domain map">
      {MODELS.map((m) => (
        <article key={m.name} className="docs-domain-card">
          <h4>{m.name}</h4>
          <p>{m.role}</p>
          <code>{m.key}</code>
        </article>
      ))}
    </div>
  );
}
