import sys
import logging
import time
from typing import Optional, Any

# ANSI Color Codes for terminal
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    
    # Foreground
    BLACK = "\033[30m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"
    
    # Bright
    BRIGHT_BLACK = "\033[90m"
    BRIGHT_RED = "\033[91m"
    BRIGHT_GREEN = "\033[92m"
    BRIGHT_YELLOW = "\033[93m"
    BRIGHT_BLUE = "\033[94m"
    BRIGHT_MAGENTA = "\033[95m"
    BRIGHT_CYAN = "\033[96m"
    BRIGHT_WHITE = "\033[97m"

class ColoredFormatter(logging.Formatter):
    """Custom formatter with timestamps and category-based color styling."""
    
    CATEGORY_COLORS = {
        "API": Colors.BRIGHT_CYAN,
        "RECONCILIATION": Colors.BRIGHT_GREEN,
        "AUDITOR": Colors.BRIGHT_MAGENTA,
        "TRACER": Colors.BRIGHT_BLUE,
        "COMPARATOR": Colors.BRIGHT_YELLOW,
        "WORKBOOK": Colors.CYAN,
        "AI": Colors.BRIGHT_WHITE,
        "DATABASE": Colors.BLUE,
        "ERROR": Colors.BRIGHT_RED,
    }

    def format(self, record):
        timestamp = time.strftime("%H:%M:%S")
        category = getattr(record, "category", "APP")
        color = self.CATEGORY_COLORS.get(category, Colors.WHITE)
        level = record.levelname

        prefix = f"{Colors.BRIGHT_BLACK}[{timestamp}]{Colors.RESET} {color}{Colors.BOLD}[{category}]{Colors.RESET}"
        
        if level in ("WARNING", "ERROR", "CRITICAL"):
            lvl_color = Colors.BRIGHT_YELLOW if level == "WARNING" else Colors.BRIGHT_RED
            prefix += f" {lvl_color}{level}:{Colors.RESET}"
            
        message = super().format(record)
        return f"{prefix} {message}"

# Configure root logger
logger = logging.getLogger("IndustryAnalyzer")
logger.setLevel(logging.INFO)

# Console handler with colored formatter
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.INFO)
formatter = ColoredFormatter("%(message)s")
handler.setFormatter(formatter)

# Avoid duplicate handlers on reload
if not logger.handlers:
    logger.addHandler(handler)
logger.propagate = False

def log_event(category: str, msg: str, level: str = "INFO"):
    extra = {"category": category}
    if level == "DEBUG":
        logger.debug(msg, extra=extra)
    elif level == "WARNING":
        logger.warning(msg, extra=extra)
    elif level == "ERROR":
        logger.error(msg, extra=extra)
    else:
        logger.info(msg, extra=extra)

# Domain-specific logging helpers
def log_api(msg: str):
    log_event("API", msg)

def log_reconciliation(msg: str):
    log_event("RECONCILIATION", msg)

def log_audit(msg: str):
    log_event("AUDITOR", msg)

def log_tracer(msg: str):
    log_event("TRACER", msg)

def log_comparator(msg: str):
    log_event("COMPARATOR", msg)

def log_workbook(msg: str):
    log_event("WORKBOOK", msg)

def log_ai(msg: str):
    log_event("AI", msg)

def log_error(msg: str, exc: Optional[Exception] = None):
    err_str = f"{msg} (Error: {exc})" if exc else msg
    log_event("ERROR", err_str, level="ERROR")
