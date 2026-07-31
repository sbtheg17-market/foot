/**
 * React Query hooks for the provider service catalog.
 *
 * Optimistic-update discipline:
 *  1. onMutate  — cancel queries, snapshot cache, write optimistic value
 *  2. onError   — restore snapshot
 *  3. onSettled — invalidate related keys (list + dashboard summary)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { qk } from "../../lib/queryKeys";

const tempId = () => `temp-${Math.random().toString(36).slice(2, 10)}`;

export const useServices = () =>
  useQuery({
    queryKey: qk.services.list(),
    queryFn: async () => (await api.get("/services")).data,
    staleTime: 30_000,
  });

export const useProviderSummary = () =>
  useQuery({
    queryKey: qk.dashboard.providerSummary,
    queryFn: async () => (await api.get("/dashboard/provider-summary")).data,
    staleTime: 15_000,
  });

const invalidateServiceCaches = (qc) => {
  qc.invalidateQueries({ queryKey: qk.services.all });
  qc.invalidateQueries({ queryKey: qk.dashboard.providerSummary });
};

export const useCreateService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post("/services", payload)).data,
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: qk.services.list() });
      const prev = qc.getQueryData(qk.services.list()) || [];
      const optimistic = { id: tempId(), _optimistic: true, ...payload };
      qc.setQueryData(qk.services.list(), [...prev, optimistic]);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.services.list(), ctx.prev),
    onSettled: () => invalidateServiceCaches(qc),
  });
};

export const useUpdateService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }) => (await api.put(`/services/${id}`, patch)).data,
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.services.list() });
      const prev = qc.getQueryData(qk.services.list()) || [];
      qc.setQueryData(qk.services.list(), prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.services.list(), ctx.prev),
    onSettled: () => invalidateServiceCaches(qc),
  });
};

export const useToggleService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.patch(`/services/${id}/toggle`)).data,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.services.list() });
      const prev = qc.getQueryData(qk.services.list()) || [];
      qc.setQueryData(
        qk.services.list(),
        prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.services.list(), ctx.prev),
    onSettled: () => invalidateServiceCaches(qc),
  });
};

export const useDeleteService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/services/${id}`)).data,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.services.list() });
      const prev = qc.getQueryData(qk.services.list()) || [];
      qc.setQueryData(qk.services.list(), prev.filter((s) => s.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.services.list(), ctx.prev),
    onSettled: () => invalidateServiceCaches(qc),
  });
};
