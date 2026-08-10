"""
setup.py - py2app build configuration for JRT Tect ANALIST Pro 3.4
Run with: python3 setup.py py2app
"""

import os
import sys
from setuptools import setup

def find_data_files(src_dir, dest_prefix):
    data_files = []
    for root, dirs, files in os.walk(src_dir):
        # Skip pycache and hidden files
        if '__pycache__' in root or '.git' in root:
            continue
        file_list = []
        for f in files:
            if f.startswith('.'):
                continue
            file_list.append(os.path.join(root, f))
        if file_list:
            rel_path = os.path.relpath(root, src_dir)
            if rel_path == '.':
                dest_dir = dest_prefix
            else:
                dest_dir = os.path.join(dest_prefix, rel_path)
            data_files.append((dest_dir, file_list))
    return data_files

APP = ['AnalistProStudioApp.py']

# Collect data files
DATA_FILES = [
    ('', ['localhost_server.py']),
]

# Add web directory recursively
web_src = os.path.join('HondaECUTool', 'data', 'web')
if os.path.exists(web_src):
    DATA_FILES.extend(find_data_files(web_src, os.path.join('HondaECUTool', 'data', 'web')))

OPTIONS = {
    'argv_emulation': False,
    'plist': {
        'CFBundleName': 'JRT Tect ANALIST Pro',
        'CFBundleDisplayName': 'JRT Tect ANALIST Pro',
        'CFBundleGetInfoString': "Honda ECU Remap Studio",
        'CFBundleIdentifier': "com.jrt-tect.analist-pro",
        'CFBundleVersion': "3.4",
        'CFBundleShortVersionString': "3.4",
        'LSBackgroundOnly': False,
    },
    # Ensure dependencies are included
    'packages': ['webview', 'aiohttp', 'jinja2', 'serial', 'pyftdi', 'usb', 'numpy', 'bottle', 'pylibftdi'],
    'excludes': ['PyInstaller', 'py2app', 'setuptools', 'distutils', 'tkinter', 'matplotlib', 'wxPython', 'PyQt5', 'PyQt5-Qt5', 'PyQt5_sip', 'xlsxwriter', 'supervisor', 'redis', 'Flask', 'scapy', 'scapy-python3', 'paramiko', 'cryptography', 'bcrypt', 'shodan', 'impacket'],
    'iconfile': None, # No custom icon specified
}

setup(
    app=APP,
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)
