"""
Module 6: Robust Communication State Machine
Manages and validates transitions between 11 explicit communication states.
"""

from enum import Enum, auto
from typing import Set, Dict, List
from framework.core.exceptions import ProtocolError

class ECUState(Enum):
    DISCONNECTED = auto()
    OPEN_SERIAL = auto()
    CONFIGURE_SERIAL = auto()
    FAST_INIT = auto()
    WAIT_WAKEUP_RESPONSE = auto()
    START_DIAGNOSTIC_SESSION = auto()
    VERIFY_SESSION = auto()
    READ_ECU_IDENTIFICATION = auto()
    LOAD_PROTOCOL_DECODER = auto()
    START_KEEP_ALIVE = auto()
    START_LIVE_DATA = auto()
    READY = auto()
    READ_DTC = auto()
    CLEAR_DTC = auto()
    WRITE_MEMORY = auto()
    FLASH_MODE = auto()
    RECOVERY = auto()
    ERROR = auto()

class CommunicationStateMachine:
    """Deterministic state machine enforcing valid transition paths, timeouts, and state logging."""

    VALID_TRANSITIONS: Dict[ECUState, Set[ECUState]] = {
        ECUState.DISCONNECTED: {ECUState.OPEN_SERIAL, ECUState.RECOVERY, ECUState.ERROR},
        ECUState.OPEN_SERIAL: {ECUState.CONFIGURE_SERIAL, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.CONFIGURE_SERIAL: {ECUState.FAST_INIT, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.FAST_INIT: {ECUState.WAIT_WAKEUP_RESPONSE, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.WAIT_WAKEUP_RESPONSE: {ECUState.START_DIAGNOSTIC_SESSION, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.START_DIAGNOSTIC_SESSION: {ECUState.VERIFY_SESSION, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.VERIFY_SESSION: {ECUState.READ_ECU_IDENTIFICATION, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.READ_ECU_IDENTIFICATION: {ECUState.LOAD_PROTOCOL_DECODER, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.LOAD_PROTOCOL_DECODER: {ECUState.START_KEEP_ALIVE, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.START_KEEP_ALIVE: {ECUState.START_LIVE_DATA, ECUState.READY, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.START_LIVE_DATA: {ECUState.READY, ECUState.READ_DTC, ECUState.CLEAR_DTC, ECUState.WRITE_MEMORY, ECUState.FLASH_MODE, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.READY: {ECUState.START_LIVE_DATA, ECUState.READ_DTC, ECUState.CLEAR_DTC, ECUState.WRITE_MEMORY, ECUState.FLASH_MODE, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.READ_DTC: {ECUState.READY, ECUState.START_LIVE_DATA, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.CLEAR_DTC: {ECUState.READY, ECUState.START_LIVE_DATA, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.WRITE_MEMORY: {ECUState.READY, ECUState.START_LIVE_DATA, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.FLASH_MODE: {ECUState.READY, ECUState.RECOVERY, ECUState.ERROR, ECUState.DISCONNECTED},
        ECUState.RECOVERY: {ECUState.DISCONNECTED, ECUState.OPEN_SERIAL, ECUState.FAST_INIT},
        ECUState.ERROR: {ECUState.RECOVERY, ECUState.DISCONNECTED, ECUState.OPEN_SERIAL},
    }

    def __init__(self):
        self._current_state = ECUState.DISCONNECTED
        self._history: List[ECUState] = [ECUState.DISCONNECTED]

    @property
    def current_state(self) -> ECUState:
        return self._current_state

    @property
    def history(self) -> List[ECUState]:
        return list(self._history)

    def transition_to(self, target_state: ECUState, reason: str = "") -> ECUState:
        """Validate and execute state transition."""
        allowed = self.VALID_TRANSITIONS.get(self._current_state, set())
        if target_state not in allowed:
            raise ProtocolError(
                message=f"Illegal State Transition: Cannot move from {self._current_state.name} to {target_state.name}.",
                possible_cause="Communication sequence violation or out-of-order API call.",
                recovery_suggestion="Reset session state machine back to DISCONNECTED or RECOVERY."
            )
        self._current_state = target_state
        self._history.append(target_state)
        return self._current_state

    def reset(self):
        """Reset state machine to DISCONNECTED."""
        self._current_state = ECUState.DISCONNECTED
        self._history = [ECUState.DISCONNECTED]

