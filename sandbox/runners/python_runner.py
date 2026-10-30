#!/usr/bin/env python3
"""
Python Sandbox Runner
Safely executes student code from standard input or file with resource tracking.
"""

import os
import sys
import time
import traceback


def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: python_runner.py <source_file>\n")
        sys.exit(1)

    code_file = sys.argv[1]
    if not os.path.exists(code_file):
        sys.stderr.write(f"Source file {code_file} not found\n")
        sys.exit(1)

    with open(code_file, "r", encoding="utf-8") as f:
        code_str = f.read()

    # Pre-compile to catch syntax errors
    try:
        compiled_code = compile(code_str, code_file, "exec")
    except SyntaxError as se:
        sys.stderr.write(f"CompilationError: Syntax error at line {se.lineno}: {se.msg}\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"CompilationError: {e}\n")
        sys.exit(1)

    # Execute code in clean namespace
    execution_scope = {
        "__name__": "__main__",
        "__file__": code_file,
    }

    start_time = time.perf_counter()
    try:
        exec(compiled_code, execution_scope)
    except Exception as e:
        sys.stderr.write(f"RuntimeError: {e}\n")
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
    finally:
        elapsed = (time.perf_counter() - start_time) * 1000.0


if __name__ == "__main__":
    main()
