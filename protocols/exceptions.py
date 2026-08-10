"""
Structured Exception Hierarchy for Honda ECU Protocol Engine
Replaces generic exceptions with domain-specific, typed exceptions.
"""

class ECUException(Exception):
    """Base exception for all ECU protocol & communication failures."""
    pass

class TransportError(ECUException):
    """Raised when serial hardware or FTDI transport layer fails."""
    pass

class SessionTimeout(ECUException):
    """Raised when ECU does not respond within expected frame timeout."""
    pass

class UnexpectedFrame(ECUException):
    """Raised when ECU returns malformed frame or unexpected header."""
    pass

class ProtocolMismatch(ECUException):
    """Raised when frame checksum or sequence format violates K-Line specification."""
    pass

class UnsupportedECU(ECUException):
    """Raised when ECU model or firmware architecture is not supported."""
    pass

class LowVoltageError(ECUException):
    """Raised when system voltage Vbat is below safety threshold (<11.5V)."""
    pass

class AuthenticationNotSupported(ECUException):
    """Raised when no verified security strategy is registered for the target ECU model."""
    pass

class AuthenticationFailed(ECUException):
    """Raised when ECU rejects security access key (e.g. NRC 0x33)."""
    pass

class FlashVerificationFailed(ECUException):
    """Raised when post-write read-back comparison detects byte mismatches."""
    pass
