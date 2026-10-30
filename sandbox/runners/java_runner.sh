#!/bin/bash
# Java Runner: Compiles and executes Java solution
set -e

SOURCE_FILE="${1:-Solution.java}"
CLASS_NAME="Solution"

if [ ! -f "$SOURCE_FILE" ]; then
    echo "CompilationError: Source file $SOURCE_FILE not found" >&2
    exit 1
fi

# Compile Java source
javac -d /tmp "$SOURCE_FILE" 2> /tmp/compile.err
if [ $? -ne 0 ]; then
    cat /tmp/compile.err >&2
    exit 1
fi

# Execute Java bytecode with memory cap
exec java -Xmx256m -Xss16m -cp /tmp "$CLASS_NAME"
