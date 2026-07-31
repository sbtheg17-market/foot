import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { qk } from "../../lib/queryKeys";

export const bookingKeys = {
  all: ["bookings"],
  list: (tab) => ["bookings", "list", tab],
  detail: (id) => ["bookings", "detail", id],
};

export const useBookings = (tab = "upcoming") =>
  useQuery({
    queryKey: bookingKeys.list(tab),
    queryFn: async () => (await api.get(`/bookings?tab=${tab}`)).data,
    staleTime: 30_000,
  });

export const useBooking = (id) =>
  useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: async () => (await api.get(`/bookings/${id}`)).data,
    enabled: !!id,
  });

const invalidateBookings = (qc) => {
  qc.invalidateQueries({ queryKey: bookingKeys.all });
  qc.invalidateQueries({ queryKey: qk.dashboard.providerSummary });
};

export const useUpdateBookingStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reason }) =>
      (await api.patch(`/bookings/${id}/status`, { status, reason })).data,
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: bookingKeys.detail(id) });
      const prev = qc.getQueryData(bookingKeys.detail(id));
      if (prev) qc.setQueryData(bookingKeys.detail(id), { ...prev, status });
      return { prev, id };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(bookingKeys.detail(ctx.id), ctx.prev),
    onSettled: () => invalidateBookings(qc),
  });
};

export const useSeedBookings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post("/dev/seed-bookings")).data,
    onSettled: () => invalidateBookings(qc),
  });
};
