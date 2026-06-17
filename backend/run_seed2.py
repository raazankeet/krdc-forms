"""Wrapper to run seed_db with error capture."""
import subprocess
import sys
import os

os.chdir(r"c:\Users\chemd\Desktop\Ankit\Python\AI\Demo Ready\AgenticAI\GLP-Forms\backend")
result = subprocess.run(
    [sys.executable, "-u", "seed_db.py"],
    capture_output=True,
    text=True,
    timeout=120,
)
print("STDOUT:", result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout)
print("STDERR:", result.stderr[-2000:] if len(result.stderr) > 2000 else result.stderr)
print("Return code:", result.returncode)
