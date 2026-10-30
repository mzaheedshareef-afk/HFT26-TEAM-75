#!/bin/bash
# C++ Runner: Compiles and executes C++ solution
set -e

SOURCE_FILE="${1:-solution.cpp}"
EXE_FILE="/tmp/solution.out"

if [ ! -f "$SOURCE_FILE" ]; then
    echo "CompilationError: Source file $SOURCE_FILE not found" >&2
    exit 1
fi

# Compile with strict optimization and standard
g++ -O3 -std=c++17 -Wall -Wextra "$SOURCE_FILE" -o "$EXE_FILE" 2> /tmp/compile.err
if [ $? -ne 0 ]; then
    cat /tmp/compile.err >&2
    exit 1
fi

# Execute binary
exec "$EXE_FILE"
