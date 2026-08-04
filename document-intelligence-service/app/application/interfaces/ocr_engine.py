from abc import ABC, abstractmethod
import numpy as np
from app.domain.entities import PageResult


class IOcrEngine(ABC):
    @abstractmethod
    def extract_text(self, image: np.ndarray, page_number: int = 1) -> PageResult:
        """Extracts lines of text, confidence scores, and coordinates from a visual image frame."""
        pass
