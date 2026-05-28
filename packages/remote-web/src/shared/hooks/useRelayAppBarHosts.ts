import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppBarHost } from "@vibe/ui/components/AppBar";
import type { RelayHost } from "shared/remote-types";
import { isRelayAvailable } from "@/shared/lib/relayCapability";
import { listPairedRelayHosts } from "@/shared/lib/relayPairingStorage";
import { listRelayHosts } from "@/shared/lib/remoteApi";

const RELAY_APP_BAR_HOSTS_QUERY_KEY = ["relay-app-bar-hosts", "hosts"] as const;
const RELAY_APP_BAR_PAIRED_HOSTS_QUERY_KEY = [
  "relay-app-bar-hosts",
  "paired-hosts",
] as const;

interface UseRelayAppBarHostsResult {
  hosts: AppBarHost[];
  isLoading: boolean;
}

export interface ResolveRelayNavigationHostOptions {
  routeHostId?: string | null;
}

export function resolveRelayNavigationHostId(
  hosts: AppBarHost[],
  options?: ResolveRelayNavigationHostOptions,
): string | null {
  const routeHostId = options?.routeHostId ?? null;
  if (routeHostId) {
    return routeHostId;
  }

  const onlineHost = hosts.find((host) => host.status === "online");
  if (onlineHost) {
    return onlineHost.id;
  }

  return null;
}

function mapRelayHostStatus(
  host: RelayHost,
  pairedHostIds: Set<string>,
): AppBarHost["status"] {
  if (!pairedHostIds.has(host.id)) {
    return "unpaired";
  }

  return host.status === "online" ? "online" : "offline";
}

export function useRelayAppBarHosts(
  enabled: boolean,
): UseRelayAppBarHostsResult {
  const relayAvailable = isRelayAvailable();
  const queryEnabled = enabled && relayAvailable;

  const hostsQuery = useQuery({
    queryKey: RELAY_APP_BAR_HOSTS_QUERY_KEY,
    queryFn: listRelayHosts,
    enabled: queryEnabled,
    staleTime: 30_000,
    refetchInterval: queryEnabled ? 30_000 : false,
  });

  const pairedHostsQuery = useQuery({
    queryKey: RELAY_APP_BAR_PAIRED_HOSTS_QUERY_KEY,
    queryFn: async () => {
      try {
        return await listPairedRelayHosts();
      } catch (error) {
        console.error("Failed to load paired relay hosts for app bar", error);
        return [];
      }
    },
    enabled: queryEnabled,
    staleTime: 5_000,
    refetchInterval: queryEnabled ? 5_000 : false,
  });

  const hosts = useMemo<AppBarHost[]>(() => {
    if (!queryEnabled) {
      return [];
    }

    const relayHosts = hostsQuery.data ?? [];
    const pairedHostIds = new Set(
      (pairedHostsQuery.data ?? []).map((host) => host.host_id),
    );

    return relayHosts.map((host) => ({
      id: host.id,
      name: host.name,
      status: mapRelayHostStatus(host, pairedHostIds),
    }));
  }, [queryEnabled, hostsQuery.data, pairedHostsQuery.data]);

  return {
    hosts,
    isLoading:
      queryEnabled && (hostsQuery.isLoading || pairedHostsQuery.isLoading),
  };
}
