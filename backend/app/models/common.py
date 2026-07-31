"""Shared Pydantic building blocks."""
from typing import Annotated

from pydantic import BeforeValidator

# Coerce ObjectId <-> str at the boundary. Storage always uses ObjectId.
PyObjectId = Annotated[str, BeforeValidator(str)]
