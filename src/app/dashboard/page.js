import {
  Badge,
  Box,
  Card,
  Flex,
  Grid,
  Heading,
  Table,
  Text,
} from "@radix-ui/themes";
import {
  IconBriefcase,
  IconCalendarStats,
  IconTargetArrow,
  IconHistory,
} from "@tabler/icons-react";
import { getDashboardData } from "@/services/dashboard";

function formatStamp(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function statusColor(status) {
  switch (status) {
    case "success":
      return "teal";
    case "partial":
      return "amber";
    case "failed":
      return "red";
    case "running":
      return "blue";
    default:
      return "gray";
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { metrics, topMatches, recentRuns, scheduler } = data;

  const metricCards = [
    {
      label: "Total Jobs Processed",
      value: metrics.totalJobs,
      icon: IconBriefcase,
    },
    {
      label: "Today's Collected Jobs",
      value: metrics.todayJobs,
      icon: IconCalendarStats,
    },
    {
      label: `High-Score Matches (≥ ${metrics.minMatchScore})`,
      value: metrics.highScoreMatches,
      icon: IconTargetArrow,
    },
    {
      label: "Last Scheduler Run",
      value: scheduler.lastRunAt
        ? formatStamp(scheduler.lastRunAt)
        : "No runs yet",
      icon: IconHistory,
      badge: scheduler.lastRunStatus || scheduler.statusLabel,
    },
  ];

  return (
    <Box>
      <Flex direction="column" gap="2" mb="5">
        <Heading size="7">Dashboard</Heading>
        <Text color="gray" size="3">
          Pipeline overview — metrics, top matches, and recent execution
          history from Neon.
        </Text>
      </Flex>

      <Grid columns={{ initial: "1", sm: "2", lg: "4" }} gap="3" mb="5">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} size="3">
              <Flex direction="column" gap="2">
                <Flex align="center" gap="2">
                  <Icon size={16} stroke={1.6} />
                  <Text size="2" color="gray">
                    {card.label}
                  </Text>
                </Flex>
                <Text size="6" weight="bold" style={{ lineHeight: 1.2 }}>
                  {card.value}
                </Text>
                {card.badge ? (
                  <Badge color={statusColor(card.badge)} variant="soft">
                    {card.badge}
                  </Badge>
                ) : null}
              </Flex>
            </Card>
          );
        })}
      </Grid>

      <Grid columns={{ initial: "1", lg: "2" }} gap="4" mb="5">
        <Card size="3">
          <Heading size="4" mb="3">
            Top Matches Spotlight
          </Heading>
          {topMatches.length === 0 ? (
            <Box
              py="6"
              style={{
                textAlign: "center",
                border: "1px dashed var(--gray-a6)",
                borderRadius: 8,
              }}
            >
              <Text color="gray" size="2">
                No scored jobs yet. Matches will appear here after the AI
                scoring pipeline runs.
              </Text>
            </Box>
          ) : (
            <Flex direction="column" gap="3">
              {topMatches.map((job) => (
                <Box
                  key={job.id}
                  p="3"
                  style={{
                    border: "1px solid var(--gray-a5)",
                    borderRadius: 8,
                    background: "var(--color-panel-solid)",
                  }}
                >
                  <Flex justify="between" gap="3" align="start">
                    <Box>
                      <Text weight="bold" size="3">
                        {job.title}
                      </Text>
                      <Text as="div" size="2" color="gray">
                        {job.company} · {job.remoteToken || job.location}
                      </Text>
                      <Text as="div" size="1" color="gray" mt="1">
                        {job.sourceWebsite}
                        {job.salary ? ` · ${job.salary}` : ""}
                      </Text>
                    </Box>
                    <Badge color="teal" size="2">
                      {Math.round(job.aiScore)}%
                    </Badge>
                  </Flex>
                </Box>
              ))}
            </Flex>
          )}
        </Card>

        <Card size="3">
          <Heading size="4" mb="3">
            Scheduler Snapshot
          </Heading>
          <Flex direction="column" gap="2">
            <Flex gap="2" wrap="wrap">
              <Badge
                color={scheduler.isEnabled ? "teal" : "gray"}
                variant="soft"
              >
                {scheduler.isEnabled ? "Scheduler Active" : "Scheduler Disabled"}
              </Badge>
              <Badge
                color={scheduler.isRunning ? "orange" : "gray"}
                variant="soft"
              >
                {scheduler.isRunning ? "Running" : "Idle"}
              </Badge>
            </Flex>
            <Text size="2" color="gray">
              Last run: {formatStamp(scheduler.lastRunAt)}
            </Text>
            <Text size="2" color="gray">
              Next run: {formatStamp(scheduler.nextRunAt)}
            </Text>
            <Text size="2" color="gray">
              Target hour (UTC):{" "}
              {scheduler.targetHourUtc != null
                ? `${scheduler.targetHourUtc}:00`
                : "—"}
            </Text>
          </Flex>
        </Card>
      </Grid>

      <Card size="3">
        <Heading size="4" mb="3">
          Recent Execution Logs
        </Heading>
        {recentRuns.length === 0 ? (
          <Box
            py="6"
            style={{
              textAlign: "center",
              border: "1px dashed var(--gray-a6)",
              borderRadius: 8,
            }}
          >
            <Text color="gray" size="2">
              No pipeline runs logged yet. Execution history will populate after
              the first scrape.
            </Text>
          </Box>
        ) : (
          <Box style={{ overflowX: "auto" }}>
            <Table.Root variant="surface" size="2">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Started</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Parsed</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Duplicates</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Processed</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Matched</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Errors</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {recentRuns.map((run) => (
                  <Table.Row key={run.id}>
                    <Table.Cell>{formatStamp(run.startedAt)}</Table.Cell>
                    <Table.Cell>
                      <Badge color={statusColor(run.status)} variant="soft">
                        {run.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{run.jobsParsed}</Table.Cell>
                    <Table.Cell>{run.jobsDeduplicated}</Table.Cell>
                    <Table.Cell>{run.jobsProcessed}</Table.Cell>
                    <Table.Cell>{run.jobsMatched}</Table.Cell>
                    <Table.Cell>{run.errorCount}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Card>
    </Box>
  );
}
