import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { qk } from "../../lib/queryKeys";

export const availabilityKey = ["availability"];

export const useAvailability = () =>
  useQuery({
    queryKey: availabilityKey,
    queryFn: async () => (await api.get("/availability")).data,
    staleTime: 30_000,
  });

export const useUpdateAvailability = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.put("/availability", payload)).data,
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: availabilityKey });
      const prev = qc.getQueryData(availabilityKey);
      qc.setQueryData(availabilityKey, { ...(prev || {}), ...payload });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(availabilityKey, ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: availabilityKey });
      qc.invalidateQueries({ queryKey: qk.dashboard.providerSummary });
    },
  });
};
