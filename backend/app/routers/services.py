"""Service catalog endpoints (Checkpoint 2).

Provider ownership is enforced by the service layer.
Permission gates are RBAC-driven so admin read/manage can be added later
without changing route bodies.
"""
from fastapi import APIRouter, Depends, status

from app.core.permissions import Permission, require_permission
from app.models.service import ServiceCreate, ServiceOut, ServiceUpdate, service_to_out
from app.services import catalog_service

router = APIRouter(prefix="/services", tags=["services"])


@router.get("", response_model=list[ServiceOut], response_model_by_alias=False)
async def list_services(user: dict = Depends(require_permission(Permission.SERVICE_READ_SELF))):
    docs = await catalog_service.list_services(user["_id"])
    return [service_to_out(d) for d in docs]


@router.post("", response_model=ServiceOut, response_model_by_alias=False, status_code=status.HTTP_201_CREATED)
async def create_service(body: ServiceCreate, user: dict = Depends(require_permission(Permission.SERVICE_CREATE_SELF))):
    doc = await catalog_service.create_service(body, user["_id"])
    return service_to_out(doc)


@router.get("/{service_id}", response_model=ServiceOut, response_model_by_alias=False)
async def get_service(service_id: str, user: dict = Depends(require_permission(Permission.SERVICE_READ_SELF))):
    doc = await catalog_service.get_service(service_id, user["_id"])
    return service_to_out(doc)


@router.put("/{service_id}", response_model=ServiceOut, response_model_by_alias=False)
async def update_service(service_id: str, body: ServiceUpdate, user: dict = Depends(require_permission(Permission.SERVICE_UPDATE_SELF))):
    doc = await catalog_service.update_service(service_id, body, user["_id"])
    return service_to_out(doc)


@router.patch("/{service_id}/toggle", response_model=ServiceOut, response_model_by_alias=False)
async def toggle_service(service_id: str, user: dict = Depends(require_permission(Permission.SERVICE_UPDATE_SELF))):
    doc = await catalog_service.toggle_service(service_id, user["_id"])
    return service_to_out(doc)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(service_id: str, user: dict = Depends(require_permission(Permission.SERVICE_DELETE_SELF))):
    await catalog_service.delete_service(service_id, user["_id"])
    return None
