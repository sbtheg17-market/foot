import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export const earningsKey = ["earnings", "summary"];

export const useEarnings = () =>
  useQuery({
    queryKey: earningsKey,
    queryFn: async () => (await api.get("/earnings/summary")).data,
    staleTime: 30_000,
  });
