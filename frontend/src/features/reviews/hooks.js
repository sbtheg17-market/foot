import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export const reviewKeys = {
  all: ["reviews"],
  list: () => ["reviews", "list"],
  summary: () => ["reviews", "summary"],
};

export const useReviews = () =>
  useQuery({
    queryKey: reviewKeys.list(),
    queryFn: async () => (await api.get("/reviews")).data,
    staleTime: 30_000,
  });

export const useReviewsSummary = () =>
  useQuery({
    queryKey: reviewKeys.summary(),
    queryFn: async () => (await api.get("/reviews/summary")).data,
    staleTime: 30_000,
  });
