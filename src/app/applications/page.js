"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Select,
  Table,
  Text,
} from "@radix-ui/themes";
import {
  IconRefresh,
  IconFileSpreadsheet,
  IconPlayerPlay,
} from "@tabler/icons-react";

export default function ApplicationsPage() {
  const [summary, setSummary] = useState(null);
  const [applications, setApplications] = useState([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [enqueueing, setEnqueueing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
      const res = await fetch(`/api/applications${q}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to load");
      setSummary(data.summary);
      setApplications(data.applications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function enqueue() {
    setEnqueueing(true);
    try {
      const res = await fetch("/api/apply/enqueue", { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Enqueue failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnqueueing(false);
    }
  }

  return (
    <Box style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 16px" }}>
      <Flex justify="between" align="center" wrap="wrap" gap="3" mb="4">
        <Box>
          <Heading size="7">Applications</Heading>
          <Text color="gray" size="2">
            Track auto-apply queue (max 35/day). Worker runs on your PC — free.
          </Text>
        </Box>
        <Flex gap="2" wrap="wrap">
          <Button variant="soft" onClick={load} disabled={loading}>
            <IconRefresh size={16} /> Refresh
          </Button>
          <Button variant="soft" onClick={enqueue} disabled={enqueueing}>
            <IconPlayerPlay size={16} /> Enqueue
          </Button>
          <Button asChild variant="solid">
            <a href="/api/applications?export=1">
              <IconFileSpreadsheet size={16} /> Excel
            </a>
          </Button>
        </Flex>
      </Flex>

      {error ? (
        <Text color="red" mb="3">
          {error}
        </Text>
      ) : null}

      {summary ? (
        <Flex gap="3" wrap="wrap" mb="4">
          <Stat
            label="Quota today"
            value={`${summary.used}/${summary.quota}`}
            color="teal"
          />
          <Stat label="Remaining" value={String(summary.remaining)} />
          <Stat label="Queued" value={String(summary.queued)} />
          <Stat label="Needs review" value={String(summary.needsReview)} color="amber" />
          <Stat label="Submitted today" value={String(summary.submittedToday)} color="green" />
          <Stat label="Failed today" value={String(summary.failedToday)} color="red" />
        </Flex>
      ) : null}

      <Flex align="center" gap="2" mb="3">
        <Text size="2">Filter</Text>
        <Select.Root value={status} onValueChange={setStatus}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="all">All</Select.Item>
            <Select.Item value="queued">Queued</Select.Item>
            <Select.Item value="preparing">Preparing</Select.Item>
            <Select.Item value="submitted">Submitted</Select.Item>
            <Select.Item value="needs_review">Needs review</Select.Item>
            <Select.Item value="failed">Failed</Select.Item>
            <Select.Item value="skipped">Skipped</Select.Item>
          </Select.Content>
        </Select.Root>
        <Text size="2" color="gray">
          Min score {summary?.minScore ?? 75} ·{" "}
          {summary?.enabled ? "apply enabled" : "apply disabled"}
        </Text>
      </Flex>

      <Card>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Score</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>ATS</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Company</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Link</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={6}>Loading…</Table.Cell>
              </Table.Row>
            ) : applications.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  No applications yet. Run pipeline or click Enqueue.
                </Table.Cell>
              </Table.Row>
            ) : (
              applications.map((app) => (
                <Table.Row key={app.id}>
                  <Table.Cell>
                    <Badge color={statusColor(app.status)} variant="soft">
                      {app.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {typeof app.aiScore === "number"
                      ? Math.round(app.aiScore)
                      : "—"}
                  </Table.Cell>
                  <Table.Cell>{app.atsType}</Table.Cell>
                  <Table.Cell>{app.job?.title || "—"}</Table.Cell>
                  <Table.Cell>{app.job?.company || "—"}</Table.Cell>
                  <Table.Cell>
                    <a href={app.applyUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Root>
      </Card>

      <Text size="1" color="gray" mt="4" as="p">
        Local worker: <code>npm run apply:worker</code> (Playwright, dry-run with{" "}
        <code>APPLY_DRY_RUN=1</code>). Hard ATS → needs_review → Telegram{" "}
        <code>/approvals</code>.
      </Text>
    </Box>
  );
}

function Stat({ label, value, color = "gray" }) {
  return (
    <Card style={{ minWidth: 120 }}>
      <Text size="1" color="gray">
        {label}
      </Text>
      <Text size="5" weight="bold" color={color}>
        {value}
      </Text>
    </Card>
  );
}

function statusColor(status) {
  switch (status) {
    case "submitted":
      return "green";
    case "needs_review":
      return "amber";
    case "failed":
      return "red";
    case "queued":
      return "blue";
    case "skipped":
      return "gray";
    default:
      return "gray";
  }
}
