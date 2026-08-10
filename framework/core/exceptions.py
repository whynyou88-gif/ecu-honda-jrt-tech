"""
Module 7: Rich Error System
Replaces generic exceptions with structured, diagnostic error objects.
Every error includes packet context, expected vs actual response, cause analysis, and recovery suggestions.
"""

from typing import Optional, Any

class FrameworkError(Exception):
    """
    Base diagnostic exception class.
    Carries structured context to assist developer debugging and user recovery.
    """
    def __init__(
        self,
        message: str,
        packet: Optional[Any] = None,
        expected_response: str = "",
        actual_response: str = "",
        possible_cause: str = "",
        recovery_suggestion: str = ""
    ):
        super().__init__(message)
        self.message = message
        self.packet = packet
        self.expected_response = expected_response
        self.actual_response = actual_response
        self.possible_cause = possible_cause
        self.recovery_suggestion = recovery_suggestion

    def to_dict(self) -> dict:
        """Serialize error object for logging or UI display."""
        return {
            "error_type": self.__class__.__name__,
            "message": self.message,
            "packet": str(self.packet) if self.packet else None,
            "expected_response": self.expected_response,
            "actual_response": self.actual_response,
            "possible_cause": self.possible_cause,
            "recovery_suggestion": self.recovery_suggestion
        }

    def __str__(self) -> str:
        details = [self.message]
        if self.expected_response or self.actual_response:
            details.append(f"Expected: {self.expected_response} | Actual: {self.actual_response}")
        if self.possible_cause:
            details.append(f"Possible Cause: {self.possible_cause}")
        if self.recovery_suggestion:
            details.append(f"Recovery Suggestion: {self.recovery_suggestion}")
        return " | ".join(details)


class ProtocolError(FrameworkError):
    """Raised when protocol layer encounters frame formatting or header errors."""
    pass

class ChecksumError(FrameworkError):
    """Raised when frame checksum verification fails."""
    pass

class TimeoutError(FrameworkError):
    """Raised when ECU fails to respond within expected timeout window."""
    pass

class UnexpectedResponse(FrameworkError):
    """Raised when ECU responds with unexpected frame structure or NRC marker."""
    pass

class UnsupportedECU(FrameworkError):
    """Raised when connected ECU model or firmware architecture is unrecognized."""
    pass

class UnsupportedCommand(FrameworkError):
    """Raised when requested service or subfunction is not supported by ECU."""
    pass

class CommunicationLost(FrameworkError):
    """Raised when physical bus communication drops during an active session."""
    pass

class UnknownProtocol(FrameworkError):
    """Raised when requested communication protocol plugin is unavailable."""
    pass

class AuthenticationNotSupported(FrameworkError):
    """Raised when no verified security strategy is registered for the target ECU model."""
    pass

class AuthenticationFailed(FrameworkError):
    """Raised when ECU rejects security access key (e.g. NRC 0x33)."""
    pass

class FlashVerificationFailed(FrameworkError):
    """Raised when post-write read-back comparison detects byte mismatches."""
    pass

class LowVoltageError(FrameworkError):
    """Raised when system voltage Vbat is below safety threshold (<11.5V)."""
    pass
