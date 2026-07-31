"""Invoices endpoints. HTML view is React-side; here we serve JSON + PDF binary."""
from fastapi import APIRouter, Depends, Response

from app.core.permissions import Permission, require_permission
from app.models.invoice import InvoiceOut
from app.services import invoice_service, pdf_service


router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.get("", response_model=list[InvoiceOut], response_model_by_alias=False)
async def list_invoices(user: dict = Depends(require_permission(Permission.INVOICE_READ_SELF))):
    docs = await invoice_service.list_invoices(user["_id"])
    return [InvoiceOut(**d) for d in docs]


@router.get("/{invoice_id}", response_model=InvoiceOut, response_model_by_alias=False)
async def get_invoice(invoice_id: str, user: dict = Depends(require_permission(Permission.INVOICE_READ_SELF))):
    doc = await invoice_service.get_invoice(invoice_id, user["_id"])
    return InvoiceOut(**doc)


@router.get("/{invoice_id}/pdf")
async def get_invoice_pdf(invoice_id: str, user: dict = Depends(require_permission(Permission.INVOICE_READ_SELF))):
    doc = await invoice_service.get_invoice(invoice_id, user["_id"])
    pdf_bytes = pdf_service.render_invoice_pdf(doc)
    filename = f"{doc.get('invoice_number', 'invoice')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
