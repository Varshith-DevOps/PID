from abc import ABC, abstractmethod


class IDocumentParser(ABC):
    @abstractmethod
    def parse_document(self, file_path: str) -> dict:
        """Parses layout trees, headings, equations, and tables from a digital document file."""
        pass
