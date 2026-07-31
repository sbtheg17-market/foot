import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export const invoiceKeys = {
  all: ["invoices"],
  list: () => ["invoices", "list"],
  detail: (id) => ["invoices", "detail", id],
};

export const useInvoices = () =>
  useQuery({
    queryKey: invoiceKeys.list(),
    queryFn: async () => (await api.get("/invoices")).data,
    staleTime: 30_000,
  });

export const useInvoice = (id) =>
  useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: async () => (await api.get(`/invoices/${id}`)).data,
    enabled: !!id,
  });
