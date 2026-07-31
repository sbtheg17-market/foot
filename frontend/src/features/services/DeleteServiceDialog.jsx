import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { formatApiErrorDetail } from "../../lib/api";
import { useDeleteService } from "./hooks";

export const DeleteServiceDialog = ({ service, onOpenChange }) => {
  const del = useDeleteService();
  const open = !!service;

  const confirm = async () => {
    try {
      await del.mutateAsync(service.id);
      toast.success("Service removed");
      onOpenChange(null);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onOpenChange(null)}>
      <AlertDialogContent data-testid="service-delete-dialog" className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this service?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{service?.name}</span> will no longer be
            available for new bookings. Existing bookings are unaffected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="service-delete-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="service-delete-confirm"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
