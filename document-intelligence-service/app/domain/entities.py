from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x_min: float = Field(..., alias="xMin")
    y_min: float = Field(..., alias="yMin")
    x_max: float = Field(..., alias="xMax")
    y_max: float = Field(..., alias="yMax")

    class Config:
        populate_by_name = True


class TextLine(BaseModel):
    text: str
    confidence: float
    bounding_box: BoundingBox = Field(..., alias="boundingBox")

    class Config:
        populate_by_name = True


class TableBlock(BaseModel):
    html_content: str = Field(..., alias="htmlContent")
    markdown_content: str = Field(..., alias="markdownContent")
    bounding_box: BoundingBox | None = Field(default=None, alias="boundingBox")

    class Config:
        populate_by_name = True


class PageResult(BaseModel):
    page_number: int = Field(..., alias="pageNumber")
    width: int
    height: int
    lines: list[TextLine] = Field(default_factory=list)
    confidence: float
    detected_language: str = Field(default="en", alias="detectedLanguage")

    class Config:
        populate_by_name = True


class DocumentResult(BaseModel):
    plain_text: str = Field(..., alias="plainText")
    markdown: str | None = None
    confidence: float
    engine_used: str = Field(..., alias="engineUsed")
    pages: list[PageResult] = Field(default_factory=list)
    tables: list[TableBlock] = Field(default_factory=list)
    processing_time_ms: int = Field(..., alias="processingTimeMs")

    class Config:
        populate_by_name = True
