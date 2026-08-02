"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Switch,
  Text,
  TextArea,
  TextField,
  Callout,
} from "@radix-ui/themes";
import {
  IconDatabase,
  IconBrain,
  IconBrandTelegram,
  IconClockHour4,
  IconDeviceFloppy,
  IconPlayerPlay,
  IconRefresh,
  IconPlugConnected,
} from "@tabler/icons-react";

const emptyForm = {
  aiApiKey: "",
  targetProfile: "",
  maxJobs: 200,
  minMatchScore: 85,
  telegramBotToken: "",
  telegramChatId: "",
  isEnabled: false,
  targetHourUtc: 9,
};

export default function SettingsPage() {
  const [form, setForm] = useState(emptyForm);
  const [dbStatus, setDbStatus] = useState({
    ok: false,
    latencyMs: null,
    error: null,
  });
  const [schedulerMeta, setSchedulerMeta] = useState({
    isRunning: false,
    lastRunAt: null,
    nextRunAt: null,
    lastRunStatus: null,
  });
  const [aiKeyConfigured, setAiKeyConfigured] = useState(false);
  const [botConfigured, setBotConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [banner, setBanner] = useState(null);

  const showBanner = useCallback((tone, message) => {
    setBanner({ tone, message });
    window.setTimeout(() => setBanner(null), 4500);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, schedulerRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/scheduler"),
      ]);
      const settingsJson = await settingsRes.json();
      const schedulerJson = await schedulerRes.json();

      if (!settingsJson.success) {
        throw new Error(settingsJson.message || "Failed to load settings");
      }

      const s = settingsJson.settings;
      setDbStatus(s.database || { ok: false, latencyMs: null });
      setAiKeyConfigured(Boolean(s.ai?.apiKeyConfigured));
      setBotConfigured(Boolean(s.telegram?.botTokenConfigured));
      setForm((prev) => ({
        ...prev,
        aiApiKey: "",
        targetProfile: s.ai?.targetProfile || "",
        maxJobs: s.ai?.maxJobs ?? 200,
        minMatchScore: s.ai?.minMatchScore ?? 85,
        telegramBotToken: "",
        telegramChatId: s.telegram?.chatId || "",
        isEnabled: Boolean(schedulerJson.scheduler?.isEnabled),
        targetHourUtc:
          typeof schedulerJson.scheduler?.targetHourUtc === "number"
            ? schedulerJson.scheduler.targetHourUtc
            : 9,
      }));
      setSchedulerMeta({
        isRunning: Boolean(schedulerJson.scheduler?.isRunning),
        lastRunAt: schedulerJson.scheduler?.lastRunAt || null,
        nextRunAt: schedulerJson.scheduler?.nextRunAt || null,
        lastRunStatus: schedulerJson.scheduler?.lastRunStatus || null,
      });
    } catch (error) {
      showBanner(
        "red",
        error instanceof Error ? error.message : "Failed to load settings"
      );
    } finally {
      setLoading(false);
    }
  }, [showBanner]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePing() {
    setPinging(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setDbStatus(data.settings.database);
      showBanner(
        data.settings.database.ok ? "teal" : "red",
        data.settings.database.ok
          ? `Database reachable (${data.settings.database.latencyMs}ms)`
          : "Database ping failed"
      );
    } catch (error) {
      showBanner(
        "red",
        error instanceof Error ? error.message : "Ping failed"
      );
    } finally {
      setPinging(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const settingsPayload = {
        targetProfile: form.targetProfile,
        maxJobs: Number(form.maxJobs),
        minMatchScore: Number(form.minMatchScore),
        telegramChatId: form.telegramChatId,
      };
      if (form.aiApiKey.trim()) {
        settingsPayload.aiApiKey = form.aiApiKey.trim();
      }
      if (form.telegramBotToken.trim()) {
        settingsPayload.telegramBotToken = form.telegramBotToken.trim();
      }

      const [settingsRes, schedulerRes] = await Promise.all([
        fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settingsPayload),
        }),
        fetch("/api/scheduler", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isEnabled: form.isEnabled,
            targetHourUtc: Number(form.targetHourUtc),
          }),
        }),
      ]);

      const settingsJson = await settingsRes.json();
      const schedulerJson = await schedulerRes.json();

      if (!settingsJson.success) {
        throw new Error(settingsJson.message || "Settings save failed");
      }
      if (!schedulerJson.success) {
        throw new Error(schedulerJson.message || "Scheduler save failed");
      }

      setAiKeyConfigured(Boolean(settingsJson.settings?.ai?.apiKeyConfigured));
      setBotConfigured(
        Boolean(settingsJson.settings?.telegram?.botTokenConfigured)
      );
      setDbStatus(settingsJson.settings?.database || dbStatus);
      setForm((prev) => ({
        ...prev,
        aiApiKey: "",
        telegramBotToken: "",
        targetProfile: settingsJson.settings?.ai?.targetProfile || "",
        maxJobs: settingsJson.settings?.ai?.maxJobs ?? prev.maxJobs,
        minMatchScore:
          settingsJson.settings?.ai?.minMatchScore ?? prev.minMatchScore,
        telegramChatId: settingsJson.settings?.telegram?.chatId || "",
        isEnabled: Boolean(schedulerJson.scheduler?.isEnabled),
        targetHourUtc:
          typeof schedulerJson.scheduler?.targetHourUtc === "number"
            ? schedulerJson.scheduler.targetHourUtc
            : prev.targetHourUtc,
      }));
      setSchedulerMeta({
        isRunning: Boolean(schedulerJson.scheduler?.isRunning),
        lastRunAt: schedulerJson.scheduler?.lastRunAt || null,
        nextRunAt: schedulerJson.scheduler?.nextRunAt || null,
        lastRunStatus: schedulerJson.scheduler?.lastRunStatus || null,
      });

      showBanner("teal", "Settings saved to Neon PostgreSQL.");
    } catch (error) {
      showBanner(
        "red",
        error instanceof Error ? error.message : "Save failed"
      );
    } finally {
      setSaving(false);
    }
  }

  function formatStamp(value) {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "—";
    }
  }

  return (
    <Box>
      <Flex align="start" justify="between" gap="4" wrap="wrap" mb="5">
        <Box>
          <Heading size="7" mb="1">
            Settings
          </Heading>
          <Text color="gray" size="3">
            Configure AI matching, Telegram delivery, and automation. Values
            persist in Neon — nothing is hardcoded in the UI.
          </Text>
        </Box>
        <Button size="3" onClick={handleSave} disabled={saving || loading}>
          <IconDeviceFloppy size={16} />
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </Flex>

      {banner ? (
        <Callout.Root color={banner.tone} mb="4">
          <Callout.Text>{banner.message}</Callout.Text>
        </Callout.Root>
      ) : null}

      <Grid columns={{ initial: "1", md: "2" }} gap="4">
        <Card size="3">
          <Flex direction="column" gap="3">
            <Flex align="center" justify="between" gap="3">
              <Flex align="center" gap="2">
                <IconDatabase size={18} />
                <Heading size="4">Database Connection</Heading>
              </Flex>
              <Badge color={dbStatus.ok ? "teal" : "red"} variant="soft">
                {dbStatus.ok ? "Healthy" : "Unreachable"}
              </Badge>
            </Flex>
            <Text size="2" color="gray">
              Neon PostgreSQL health via Prisma. Latency:{" "}
              {dbStatus.latencyMs != null ? `${dbStatus.latencyMs}ms` : "—"}
            </Text>
            {dbStatus.error ? (
              <Text size="2" color="red">
                {dbStatus.error}
              </Text>
            ) : null}
            <Button
              variant="soft"
              onClick={handlePing}
              disabled={pinging}
              style={{ width: "fit-content" }}
            >
              <IconRefresh size={16} />
              {pinging ? "Pinging…" : "Ping Database"}
            </Button>
          </Flex>
        </Card>

        <Card size="3">
          <Flex direction="column" gap="3">
            <Flex align="center" gap="2">
              <IconBrain size={18} />
              <Heading size="4">AI Provider</Heading>
            </Flex>
            <TextField.Root
              type="password"
              placeholder={
                aiKeyConfigured
                  ? "Key configured — enter a new value to rotate"
                  : "Gemini / AI API key"
              }
              value={form.aiApiKey}
              onChange={(e) => updateField("aiApiKey", e.target.value)}
              autoComplete="off"
            />
            <TextArea
              placeholder="Candidate target profile / resume summary used for scoring"
              rows={6}
              value={form.targetProfile}
              onChange={(e) => updateField("targetProfile", e.target.value)}
            />
            <Grid columns="2" gap="3">
              <Box>
                <Text as="label" size="2" weight="medium" mb="1">
                  Max jobs to process
                </Text>
                <TextField.Root
                  type="number"
                  min={1}
                  max={5000}
                  value={String(form.maxJobs)}
                  onChange={(e) =>
                    updateField("maxJobs", Number(e.target.value) || 0)
                  }
                />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" mb="1">
                  Minimum match score %
                </Text>
                <TextField.Root
                  type="number"
                  min={0}
                  max={100}
                  value={String(form.minMatchScore)}
                  onChange={(e) =>
                    updateField("minMatchScore", Number(e.target.value) || 0)
                  }
                />
              </Box>
            </Grid>
          </Flex>
        </Card>

        <Card size="3">
          <Flex direction="column" gap="3">
            <Flex align="center" gap="2">
              <IconBrandTelegram size={18} />
              <Heading size="4">Telegram Notifications</Heading>
            </Flex>
            <TextField.Root
              type="password"
              placeholder={
                botConfigured
                  ? "Bot token configured — enter a new value to rotate"
                  : "Telegram bot token"
              }
              value={form.telegramBotToken}
              onChange={(e) => updateField("telegramBotToken", e.target.value)}
              autoComplete="off"
            />
            <TextField.Root
              placeholder="Chat ID"
              value={form.telegramChatId}
              onChange={(e) => updateField("telegramChatId", e.target.value)}
            />
            <Button
              variant="soft"
              style={{ width: "fit-content" }}
              onClick={() =>
                showBanner(
                  "gray",
                  "Telegram test connection will be wired in Phase 6."
                )
              }
            >
              <IconPlugConnected size={16} />
              Test Connection
            </Button>
          </Flex>
        </Card>

        <Card size="3">
          <Flex direction="column" gap="3">
            <Flex align="center" gap="2">
              <IconClockHour4 size={18} />
              <Heading size="4">Scheduler & Automation</Heading>
            </Flex>

            <Flex align="center" justify="between" gap="3">
              <Text size="2" weight="medium">
                Enable scheduler
              </Text>
              <Switch
                checked={form.isEnabled}
                onCheckedChange={(checked) => updateField("isEnabled", checked)}
              />
            </Flex>

            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Scheduled execution hour (UTC)
              </Text>
              <TextField.Root
                type="number"
                min={0}
                max={23}
                value={String(form.targetHourUtc)}
                onChange={(e) =>
                  updateField("targetHourUtc", Number(e.target.value) || 0)
                }
              />
            </Box>

            <Flex gap="2" wrap="wrap">
              <Badge color={form.isEnabled ? "teal" : "gray"} variant="soft">
                {form.isEnabled ? "Enabled" : "Disabled"}
              </Badge>
              <Badge
                color={schedulerMeta.isRunning ? "orange" : "gray"}
                variant="soft"
              >
                {schedulerMeta.isRunning ? "Running" : "Idle"}
              </Badge>
              {schedulerMeta.lastRunStatus ? (
                <Badge variant="outline">{schedulerMeta.lastRunStatus}</Badge>
              ) : null}
            </Flex>

            <Text size="2" color="gray">
              Last run: {formatStamp(schedulerMeta.lastRunAt)}
            </Text>
            <Text size="2" color="gray">
              Next scheduled: {formatStamp(schedulerMeta.nextRunAt)}
            </Text>

            <Button
              variant="soft"
              style={{ width: "fit-content" }}
              onClick={() =>
                showBanner(
                  "gray",
                  "Manual scraper trigger will be wired in Phase 7."
                )
              }
            >
              <IconPlayerPlay size={16} />
              Run Scraper Now
            </Button>
          </Flex>
        </Card>
      </Grid>

      <Flex
        mt="5"
        justify="end"
        style={{
          position: "sticky",
          bottom: 16,
          zIndex: 20,
        }}
      >
        <Button size="3" onClick={handleSave} disabled={saving || loading}>
          <IconDeviceFloppy size={16} />
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </Flex>
    </Box>
  );
}
