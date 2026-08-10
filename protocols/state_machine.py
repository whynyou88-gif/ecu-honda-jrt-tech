"""
State Machine for ECU Communication Lifecycle
Strictly manages state transitions and validates operational sequencing.
"""

from enum import Enum, auto
from typing import Set, Dict
from protocols.exceptions import ProtocolMismatch

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

class ECUStateMachine:
    """Manages valid state transitions for ECU communication lifecycle."""
    
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
        self._state_history = [ECUState.DISCONNECTED]

    @property
    def current_state(self) -> ECUState:
        return self._current_state

    def transition_to(self, target_state: ECUState, reason: str = "") -> ECUState:
        """Validate and execute a state transition."""
        allowed = self.VALID_TRANSITIONS.get(self._current_state, set())
        if target_state not in allowed:
            err = f"Illegal State Transition: Cannot move from {self._current_state.name} to {target_state.name}. Reason: {reason}"
            raise ProtocolMismatch(err)

        self._current_state = target_state
        self._state_history.append(target_state)
        return self._current_state

    def reset(self):
        """Reset state machine back to DISCONNECTED."""
        self._current_state = ECUState.DISCONNECTED
        self._state_history = [ECUState.DISCONNECTED]

