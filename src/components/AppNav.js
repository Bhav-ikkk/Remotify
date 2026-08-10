"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Box, Flex, Text } from "@radix-ui/themes";
import {
  IconLayoutDashboard,
  IconSettings,
  IconBriefcase,
} from "@tabler/icons-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/applications", label: "Applications", icon: IconBriefcase },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

const GITHUB_REPO = "https://github.com/Bhav-ikkk/Remotify";

export default function AppNav() {
  const pathname = usePathname();
  const [schedulerLabel, setSchedulerLabel] = useState("Scheduler Disabled");
  const [schedulerActive, setSchedulerActive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const res = await fetch("/api/scheduler");
        const data = await res.json();
        if (cancelled || !data.success) return;

        const enabled = Boolean(data.scheduler?.isEnabled);
        const running = Boolean(data.scheduler?.isRunning);
        setSchedulerActive(enabled);
        setSchedulerLabel(
          running
            ? "Scheduler Running"
            : enabled
              ? "Scheduler Active"
              : "Scheduler Disabled"
        );
      } catch {
        if (!cancelled) {
          setSchedulerActive(false);
          setSchedulerLabel("Scheduler Unknown");
        }
      }
    }

    loadStatus();
    const id = setInterval(loadStatus, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pathname]);

  return (
    <Box
      asChild
      style={{
        borderBottom: "1px solid var(--gray-a5)",
        background: "var(--color-panel-solid)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <header>
        <Flex
          align="center"
          justify="between"
          gap="4"
          px="4"
          py="3"
          wrap="wrap"
          style={{ maxWidth: 1120, margin: "0 auto" }}
        >
          <Flex align="center" gap="4" wrap="wrap">
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <Image
                src="/remotify-mark.png"
                alt=""
                width={28}
                height={28}
                style={{ borderRadius: 6 }}
              />
              <Text
                weight="bold"
                size="4"
                style={{
                  fontFamily: "var(--font-display), Syne, sans-serif",
                  letterSpacing: "-0.03em",
                }}
              >
                Remotify
              </Text>
            </Link>

            <Flex gap="1" asChild>
              <nav aria-label="Primary">
                {NAV.map(({ href, label, icon: Icon }) => {
                  const active =
                    pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 8,
                        textDecoration: "none",
                        color: active
                          ? "var(--accent-11)"
                          : "var(--gray-11)",
                        background: active
                          ? "var(--accent-a3)"
                          : "transparent",
                        fontWeight: active ? 600 : 500,
                        fontSize: 14,
                      }}
                    >
                      <Icon size={16} stroke={1.6} />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </Flex>
          </Flex>

          <Flex align="center" gap="3">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                color: "var(--gray-11)",
              }}
            >
              GitHub
            </a>
            <Badge
              color={schedulerActive ? "teal" : "gray"}
              variant="soft"
              size="2"
            >
              {schedulerLabel}
            </Badge>
          </Flex>
        </Flex>
      </header>
    </Box>
  );
}
