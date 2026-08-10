#!/bin/bash
# Script to setup Linux udev rules for FTDI ECU Interface
# This prevents ModemManager from interfering with the connection and disables USB autosuspend.

set -e

# Ensure the script is run with root privileges
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run this script with sudo or as root:"
  echo "sudo $0"
  exit 1
fi

RULES_FILE="/etc/udev/rules.d/99-ecu-ftdi-ignore-mm.rules"
OLD_RULES_FILE="/etc/udev/rules.d/99-ecu-ftdi.rules"

if [ -f "$OLD_RULES_FILE" ]; then
  echo "Removing old duplicate rules file: $OLD_RULES_FILE"
  rm -f "$OLD_RULES_FILE"
fi

echo "Creating udev rules file: $RULES_FILE"

cat << 'EOF' > "$RULES_FILE"
# ====================================================================
# ECU FTDI USB-Serial Rules
# Ignore device in ModemManager and disable USB autosuspend
# ====================================================================

# FT232RL (VID: 0403, PID: 6001)
SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="6001", ENV{ID_MM_DEVICE_IGNORE}="1"
SUBSYSTEM=="usb", ATTR{idVendor}=="0403", ATTR{idProduct}=="6001", TEST=="power/control", ATTR{power/control}="on"

# FT230X / FT231X (VID: 0403, PID: 6015)
SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="6015", ENV{ID_MM_DEVICE_IGNORE}="1"
SUBSYSTEM=="usb", ATTR{idVendor}=="0403", ATTR{idProduct}=="6015", TEST=="power/control", ATTR{power/control}="on"

# Catch-all for other FTDI devices (VID: 0403)
SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", ENV{ID_MM_DEVICE_IGNORE}="1"
SUBSYSTEM=="usb", ATTR{idVendor}=="0403", TEST=="power/control", ATTR{power/control}="on"
EOF

echo "Reloading udev rules..."
udevadm control --reload-rules || true

echo "Triggering udev rules..."
udevadm trigger --subsystem-match=usb --action=change || true
udevadm trigger --subsystem-match=tty --action=change || true

echo "SUCCESS: udev rules installed. FTDI devices will now bypass ModemManager and USB autosuspend."
