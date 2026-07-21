import logging
import sys
from typing import Any


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        stream=sys.stdout,
    )


def safe_log(logger: logging.Logger, message: str, **fields: Any) -> None:
    safe_fields = {
        key: value
        for key, value in fields.items()
        if key
        in {
            "workflowId",
            "tenantId",
            "organizationId",
            "jobId",
            "applicationId",
            "candidateId",
            "requestId",
            "errorCode",
        }
    }
    logger.info("%s %s", message, safe_fields)
